import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase';
import { analyzeIssuePhoto } from '@/lib/gemini';
import { getLocalIssues, saveLocalIssue } from '@/lib/temp-db';
import { Issue, IssueCategory } from '@/types';
import crypto from 'crypto';

// Helper function to calculate distance in meters (Haversine formula) for local fallback duplicate check
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType, lat, lng, additionalNotes, force_submit, analyzeOnly } = body;

    // 1. Input Validation
    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        { error: 'Bad Request: imageBase64 and mimeType are required.' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Bad Request: lat and lng must be valid numbers.' },
        { status: 400 }
      );
    }

    // 2. Multimodal analysis via Gemini
    const locationHint = `Latitude: ${latitude}, Longitude: ${longitude}. User description notes: ${additionalNotes || 'none'}`;
    let geminiAnalysis;
    try {
      geminiAnalysis = await analyzeIssuePhoto(imageBase64, mimeType, locationHint);
    } catch (geminiError) {
      console.error('Gemini classification error:', geminiError);
      const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      return NextResponse.json(
        { error: `AI Analysis Failed: ${msg}` },
        { status: 500 }
      );
    }

    // If only analysis is requested, return early without DB writes
    if (analyzeOnly) {
      return NextResponse.json({
        success: true,
        geminiAnalysis,
      });
    }

    // 3. Setup client and attempt photo upload to Supabase Storage
    let publicUrl = '';
    const fileId = crypto.randomUUID();
    const filename = `${Date.now()}-${fileId}.jpg`;

    let serviceRoleClient;
    try {
      serviceRoleClient = createSupabaseServiceClient();
    } catch {
      console.warn('Supabase service role client creation failed, using local storage/DB fallback.');
    }

    if (serviceRoleClient) {
      try {
        // Strip data prefix from base64 if present
        const cleanBase64 = imageBase64.includes(';base64,')
          ? imageBase64.split(';base64,')[1]
          : imageBase64;
        const buffer = Buffer.from(cleanBase64, 'base64');

        const { error: uploadError } = await serviceRoleClient.storage
          .from('issue-photos')
          .upload(filename, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error('Supabase storage upload failed:', uploadError.message);
        } else {
          const { data } = serviceRoleClient.storage
            .from('issue-photos')
            .getPublicUrl(filename);
          publicUrl = data?.publicUrl || '';
        }
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        console.error('Photo upload failed, proceeding with fallback URI:', msg);
      }
    }

    // If storage failed or was skipped, use a lightweight base64 prefix representation (or empty)
    if (!publicUrl) {
      publicUrl = `data:${mimeType};base64,${imageBase64.slice(0, 100)}...[truncated]`;
    }

    // 4. Duplicate Check
    let existingIssues: { id: string; title: string; category: string; status: string }[] = [];
    let isDuplicateDetected = false;

    if (serviceRoleClient) {
      try {
        // Call the database function (RPC) created in migration for PostGIS duplicate check
        const { data: dbDuplicates, error: dbError } = await serviceRoleClient.rpc(
          'check_duplicate_issues',
          {
            lng: longitude,
            lat: latitude,
            cat: geminiAnalysis.category,
          }
        );

        if (!dbError && dbDuplicates) {
          existingIssues = dbDuplicates;
          isDuplicateDetected = existingIssues.length > 0;
        } else {
          console.warn('Supabase RPC search failed or check_duplicate_issues function missing. Falling back to local check. Details:', dbError);
        }
      } catch {
        console.warn('Supabase duplicate RPC query failed, falling back to local check.');
      }
    }

    // Local spatial duplicate check fallback (within 50 meters, same category, unresolved)
    if (existingIssues.length === 0) {
      const localIssues = getLocalIssues().filter(
        (issue) =>
          issue.category === geminiAnalysis.category &&
          issue.status !== 'resolved' &&
          getDistanceMeters(latitude, longitude, issue.lat, issue.lng) <= 50
      );

      existingIssues = localIssues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        category: issue.category,
        status: issue.status,
      }));
      isDuplicateDetected = existingIssues.length > 0;
    }

    // 5. Return duplicates if found and not forced
    if (isDuplicateDetected && force_submit !== true) {
      return NextResponse.json({
        duplicate: true,
        existingIssues,
        geminiAnalysis,
      });
    }

    // 6. Insert issue record
    const reporterId = body.reporter_id || '00000000-0000-0000-0000-000000000000';
    const newIssueId = crypto.randomUUID();

    const mappedCategory = (geminiAnalysis.category === 'water_leak' ? 'water' : geminiAnalysis.category) as IssueCategory;

    const insertData: Issue = {
      id: newIssueId,
      title: geminiAnalysis.title,
      description: geminiAnalysis.description,
      category: mappedCategory,
      severity: geminiAnalysis.severity as 1 | 2 | 3 | 4 | 5,
      status: 'open',
      lat: latitude,
      lng: longitude,
      photo_urls: [publicUrl],
      upvotes: 0,
      reporter_id: reporterId,
      ward_name: 'Ward Auto-Assigned', // will be computed in PostGIS trigger or fallback
      ai_confidence: geminiAnalysis.confidence,
      suggested_department: geminiAnalysis.suggested_department,
      created_at: new Date().toISOString(),
    };

    let insertedRow: Issue = insertData;
    let savedInDb = false;

    if (serviceRoleClient) {
      try {
        const { data, error } = await serviceRoleClient
          .from('issues')
          .insert({
            id: insertData.id,
            title: insertData.title,
            description: insertData.description,
            category: insertData.category,
            severity: insertData.severity,
            status: insertData.status,
            lat: insertData.lat,
            lng: insertData.lng,
            location: `POINT(${longitude} ${latitude})`, // WKT format for PostGIS geography
            photo_urls: insertData.photo_urls,
            upvotes: insertData.upvotes,
            reporter_id: insertData.reporter_id === '00000000-0000-0000-0000-000000000000' ? null : insertData.reporter_id,
            ward_name: insertData.ward_name,
            ai_confidence: insertData.ai_confidence,
            suggested_department: insertData.suggested_department,
            created_at: insertData.created_at,
          })
          .select()
          .single();

        if (!error && data) {
          insertedRow = data;
          savedInDb = true;
        } else {
          console.error('Supabase DB Insert failed, falling back to local file. Details:', error);
        }
      } catch (insertError) {
        const msg = insertError instanceof Error ? insertError.message : String(insertError);
        console.error('Supabase insert execution crashed, falling back to local file. Details:', msg);
      }
    }

    if (!savedInDb) {
      // Fallback local file insertion
      insertedRow = saveLocalIssue(insertData);
    }

    // 7. Award points to the reporter (civic_hero_points upsert)
    if (serviceRoleClient && reporterId !== '00000000-0000-0000-0000-000000000000') {
      try {
        // Query current metrics to avoid total overwrite
        const { data: hero } = await serviceRoleClient
          .from('civic_hero_points')
          .select('points, reports_count')
          .eq('user_id', reporterId)
          .single();

        if (hero) {
          await serviceRoleClient
            .from('civic_hero_points')
            .update({
              points: (hero.points || 0) + 10,
              reports_count: (hero.reports_count || 0) + 1,
            })
            .eq('user_id', reporterId);
        } else {
          await serviceRoleClient
            .from('civic_hero_points')
            .insert({
              user_id: reporterId,
              points: 10,
              reports_count: 1,
              badge_level: 'newcomer',
            });
        }
      } catch (pointsErr) {
        const msg = pointsErr instanceof Error ? pointsErr.message : String(pointsErr);
        console.warn('Failed to upsert points in civic_hero_points table:', msg);
      }
    }

    // 8. Return success response
    return NextResponse.json({
      success: true,
      issue: insertedRow,
    });

  } catch (err) {
    console.error('API /api/report POST execution failed:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
