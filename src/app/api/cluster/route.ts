import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/gemini';
import { createApiServerClient } from '@/lib/supabase';
import { getLocalIssues } from '@/lib/temp-db';
import { Issue } from '@/types';

// Simple helper to calculate distance between coordinates in km
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, category, title, description } = body;

    if (!lat || !lng || !category || !title) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat, lng, category, and title are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch active issues
    let issues: Issue[] = [];
    try {
      const supabase = await createApiServerClient();
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('status', 'open'); // Only cluster/dedup against open issues

      if (!error && data) {
        issues = data;
      } else {
        issues = getLocalIssues().filter((i) => i.status === 'open');
      }
    } catch {
      issues = getLocalIssues().filter((i) => i.status === 'open');
    }

    // 2. Filter issues that are geographically close (e.g., within 100 meters / 0.1km)
    const nearbyIssues = issues.filter((issue) => {
      const distance = getDistanceKm(lat, lng, issue.lat, issue.lng);
      return distance <= 0.1 && issue.category === category; // same category, close distance
    });

    if (nearbyIssues.length === 0) {
      return NextResponse.json({
        isDuplicateDetected: false,
        duplicates: [],
      });
    }

    // 3. For all nearby issues of the same category, perform a semantic duplicate check using Gemini
    const duplicatesList = [];
    for (const nearby of nearbyIssues) {
      try {
        const prompt = `Compare these two civic issue reports of the same category (${category}) to check if they describe the exact same physical issue or incident:

Report A (New Submission):
Title: "${title}"
Description: "${description || 'No description provided'}"

Report B (Existing Issue):
Title: "${nearby.title}"
Description: "${nearby.description}"

Are these reports describing the same specific incident (e.g. the same pothole, the same water pipe burst, the same pile of garbage)?
You must reply with ONLY a valid raw JSON object. Do not include markdown headers or code block ticks.
Format:
{
  "isDuplicate": true,
  "confidence": 0.95,
  "rationale": "Explain why they match or differ briefly."
}`;

        const aiResponse = await generateContent(prompt);
        const cleanJson = aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.isDuplicate) {
          duplicatesList.push({
            existingIssue: nearby,
            confidence: parsed.confidence || 0.7,
            rationale: parsed.rationale || 'Similar description and category in close geographic proximity.',
          });
        }
      } catch (aiErr) {
        console.error(`AI analysis failed for duplicate check with issue ${nearby.id}:`, aiErr);
        // Simple fallback check
        if (nearby.title.toLowerCase() === title.toLowerCase()) {
          duplicatesList.push({
            existingIssue: nearby,
            confidence: 0.8,
            rationale: 'Exact title match in close proximity.',
          });
        }
      }
    }

    return NextResponse.json({
      isDuplicateDetected: duplicatesList.length > 0,
      duplicates: duplicatesList,
    });
  } catch (err) {
    console.error('API Cluster Deduplication Error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
