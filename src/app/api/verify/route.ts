import { NextResponse } from 'next/server';
import { createApiServerClient, createSupabaseServiceClient } from '@/lib/supabase';
import { 
  getLocalIssues, 
  updateLocalIssue, 
  getLocalVerifications, 
  saveLocalVerification, 
  updateLocalHeroPoints 
} from '@/lib/temp-db';
import { Issue } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Support both snake_case and camelCase parameters from request
    const issueId = body.issue_id || body.issueId;
    const verdict = body.verdict; // 'confirm' | 'dispute'
    const note = body.note || '';

    if (!issueId || !verdict || !['confirm', 'dispute'].includes(verdict)) {
      return NextResponse.json(
        { error: 'Missing or invalid parameters: issue_id/issueId and verdict ("confirm"|"dispute") are required.' },
        { status: 400 }
      );
    }

    let userId = '';
    let loadedFromDb = false;

    // 1. Authenticate user from Supabase cookies
    try {
      const supabase = await createApiServerClient();
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (!authError && session?.user?.id) {
        userId = session.user.id;
      }
    } catch {
      console.warn('Session check failed or unconfigured, checking dev bypass.');
    }

    // Bypass authentication requirement for local dev environments to simplify demoing
    if (!userId) {
      if (process.env.NODE_ENV === 'development' || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        userId = '00000000-0000-0000-0000-000000000000'; // mock guest UUID
      } else {
        return NextResponse.json(
          { error: 'Unauthorized: Authenticated user session required.' },
          { status: 401 }
        );
      }
    }

    let totalConfirmations = 0;
    let isVerified = false;

    // 2. Perform DB logic
    try {
      const supabase = createSupabaseServiceClient();

      // Check unique constraint: user cannot verify the same issue twice
      const { data: existing, error: checkErr } = await supabase
        .from('verifications')
        .select('id')
        .eq('issue_id', issueId)
        .eq('user_id', userId);

      if (!checkErr && existing && existing.length > 0) {
        return NextResponse.json(
          { error: 'Conflict: User has already verified this report.' },
          { status: 409 }
        );
      }

      // Log verification
      const { error: insertErr } = await supabase
        .from('verifications')
        .insert({
          issue_id: issueId,
          user_id: userId,
          verdict,
          note
        });

      if (insertErr) {
        if (insertErr.code === '23505') {
          return NextResponse.json(
            { error: 'Conflict: User has already verified this report.' },
            { status: 409 }
          );
        }
        throw insertErr;
      }

      // Fetch all verifications to compute consensus
      const { data: allVerifications, error: queryErr } = await supabase
        .from('verifications')
        .select('verdict')
        .eq('issue_id', issueId);

      if (!queryErr && allVerifications) {
        const confirms = allVerifications.filter(v => v.verdict === 'confirm').length;
        const disputes = allVerifications.filter(v => v.verdict === 'dispute').length;
        
        totalConfirmations = confirms;
        isVerified = confirms >= 3 && confirms > disputes;

        // Update issue verification flag if consensus is met
        if (isVerified) {
          await supabase
            .from('issues')
            .update({ verified_at: new Date().toISOString() })
            .eq('id', issueId);
        }

        // Also increment public upvotes count of the issue
        const { data: currentIssue } = await supabase.from('issues').select('upvotes').eq('id', issueId).single();
        if (currentIssue) {
          await supabase
            .from('issues')
            .update({ upvotes: (currentIssue.upvotes || 0) + 1 })
            .eq('id', issueId);
        }

        loadedFromDb = true;
      }
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.warn('Supabase verification insert failed, fallback to local database:', msg);
    }

    // 3. Fallback to Local JSON DB logic
    if (!loadedFromDb) {
      const localIssues = getLocalIssues();
      const currentIssue = localIssues.find(i => i.id === issueId);

      if (!currentIssue) {
        return NextResponse.json(
          { error: `Issue with ID ${issueId} not found.` },
          { status: 404 }
        );
      }

      const verifications = getLocalVerifications();
      const alreadyExists = verifications.some(
        v => v.issue_id === issueId && v.user_id === userId
      );

      if (alreadyExists) {
        return NextResponse.json(
          { error: 'Conflict: User has already verified this report.' },
          { status: 409 }
        );
      }

      // Save local verification
      saveLocalVerification({
        id: Math.random().toString(36).substr(2, 9),
        issue_id: issueId,
        user_id: userId,
        verdict,
        note,
        created_at: new Date().toISOString()
      });

      // Award points in mock leaderboard
      updateLocalHeroPoints(userId, 5, true);

      // Re-read local verifications to check consensus
      const allVerifications = getLocalVerifications().filter(v => v.issue_id === issueId);
      const confirms = allVerifications.filter(v => v.verdict === 'confirm').length;
      const disputes = allVerifications.filter(v => v.verdict === 'dispute').length;

      totalConfirmations = confirms;
      isVerified = confirms >= 3 && confirms > disputes;

      const updates: Partial<Issue> = {
        upvotes: (currentIssue.upvotes || 0) + 1,
      };

      if (isVerified) {
        updates.verified_at = new Date().toISOString();
      }

      updateLocalIssue(issueId, updates);
    }

    return NextResponse.json({
      success: true,
      totalConfirmations,
      isVerified
    });
  } catch (err) {
    console.error('API Verification error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
