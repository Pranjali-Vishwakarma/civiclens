import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase';
import { getLocalIssues } from '@/lib/temp-db';
import { Issue } from '@/types';
import { generatePredictiveInsight } from '@/lib/gemini';

// In-memory cache variables
let cachedStats: unknown = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds caching

// Helper to calculate health score
function calculateHealthScore(openIssuesCount: number, avgSeverity: number) {
  const score = Math.max(0, Math.round(100 - (openIssuesCount * avgSeverity * 2)));
  let status: 'healthy' | 'needs_attention' | 'critical' = 'healthy';
  if (score < 40) {
    status = 'critical';
  } else if (score <= 70) {
    status = 'needs_attention';
  }
  return { score, status };
}

export async function GET() {
  const now = Date.now();
  
  // Return cached data if valid
  if (cachedStats && (now - cacheTime < CACHE_TTL)) {
    return NextResponse.json(cachedStats);
  }

  try {
    let issues: Issue[] = [];
    let heroes: Record<string, unknown>[] = [];
    let loadedFromDb = false;

    // 1. Fetch from Supabase
    try {
      const supabase = createSupabaseServiceClient();
      const { data: dbIssues, error: issuesError } = await supabase
        .from('issues')
        .select('*');

      if (!issuesError && dbIssues) {
        issues = dbIssues;
        loadedFromDb = true;
      }

      const { data: dbHeroes, error: heroesError } = await supabase
        .from('civic_hero_points')
        .select('*')
        .order('points', { ascending: false })
        .limit(5);

      if (!heroesError && dbHeroes) {
        heroes = dbHeroes;
      }
    } catch (supabaseError) {
      console.warn('Dashboard API failed to query Supabase, using local fallback:', supabaseError);
    }

    // 2. Fallbacks
    if (!loadedFromDb) {
      issues = getLocalIssues();
    }

    if (heroes.length === 0) {
      // Mock heroes data if DB table is empty/missing
      heroes = [
        { user_id: '1', points: 120, reports_count: 8, verifications_count: 12, badge_level: 'Local Champion' },
        { user_id: '2', points: 95, reports_count: 5, verifications_count: 14, badge_level: 'Civic Guardian' },
        { user_id: '3', points: 80, reports_count: 6, verifications_count: 10, badge_level: 'Active Citizen' },
        { user_id: '4', points: 55, reports_count: 3, verifications_count: 8, badge_level: 'Helper' },
        { user_id: '5', points: 40, reports_count: 2, verifications_count: 6, badge_level: 'Newcomer' }
      ];
    }

    const mockNames = ['Aarav Patel', 'Priya Sharma', 'Aniket Deshmukh', 'Sneha Joshi', 'Rahul Mehta'];
    const enrichedHeroes = heroes.map((h, i) => ({
      ...h,
      displayName: mockNames[i] || `Civic Hero #${i + 1}`
    }));

    // 3. Compute Metrics
    const total_reports = issues.length;
    const open_count = issues.filter(i => i.status === 'open').length;
    const in_progress_count = issues.filter(i => i.status === 'in_progress').length;
    const resolved_count = issues.filter(i => i.status === 'resolved').length;
    const resolution_rate = total_reports > 0 ? Math.round((resolved_count / total_reports) * 100) : 0;

    // Average resolution hours
    let avg_resolution_hours = 0;
    const resolvedIssuesWithTimes = issues.filter(
      i => i.status === 'resolved' && i.created_at && i.resolved_at
    );
    if (resolvedIssuesWithTimes.length > 0) {
      const totalHours = resolvedIssuesWithTimes.reduce((sum, issue) => {
        const diffMs = new Date(issue.resolved_at!).getTime() - new Date(issue.created_at).getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      avg_resolution_hours = Math.round(totalHours / resolvedIssuesWithTimes.length);
    }

    // Category Breakdown
    const byCategory: Record<string, number> = {};
    issues.forEach(issue => {
      const cat = issue.category;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    // Ward Breakdown (top 5 by open issues)
    const wardOpenCounts: Record<string, number> = {};
    issues.forEach(issue => {
      if (issue.status !== 'resolved') {
        const ward = issue.ward_name || 'Ward Auto-Assigned';
        wardOpenCounts[ward] = (wardOpenCounts[ward] || 0) + 1;
      }
    });
    const byWard = Object.entries(wardOpenCounts)
      .map(([ward, count]) => ({ ward, open_issues_count: count }))
      .sort((a, b) => b.open_issues_count - a.open_issues_count)
      .slice(0, 5);

    // Civic Health Scores
    // Overall score
    const openIssues = issues.filter(i => i.status !== 'resolved');
    const openIssuesCount = openIssues.length;
    const avgSeverity = openIssuesCount > 0 
      ? openIssues.reduce((sum, i) => sum + i.severity, 0) / openIssuesCount 
      : 0;
    const overallHealth = calculateHealthScore(openIssuesCount, avgSeverity);

    // Score per ward
    const wardIssues: Record<string, Issue[]> = {};
    issues.forEach(issue => {
      const ward = issue.ward_name || 'Ward Auto-Assigned';
      if (!wardIssues[ward]) wardIssues[ward] = [];
      wardIssues[ward].push(issue);
    });

    const wardHealthScores = Object.entries(wardIssues).map(([ward, list]) => {
      const wardOpen = list.filter(i => i.status !== 'resolved');
      const count = wardOpen.length;
      const severityAvg = count > 0 
        ? wardOpen.reduce((sum, i) => sum + i.severity, 0) / count 
        : 0;
      const health = calculateHealthScore(count, severityAvg);
      return {
        ward,
        score: health.score,
        status: health.status,
        open_issues: count
      };
    }).sort((a, b) => b.score - a.score);

    // Trend: Last 7 days reported counts
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const count = issues.filter(issue => issue.created_at.startsWith(dateString)).length;
      trend.push({
        date: dateString,
        count
      });
    }

    // 4. Compute Predictive Insight Parameters for Gemini
    const nowTime = new Date();
    const weekCounts = [0, 0, 0, 0];
    issues.forEach(issue => {
      const created = new Date(issue.created_at);
      const diffMs = nowTime.getTime() - created.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) {
        weekCounts[3]++;
      } else if (diffDays <= 14) {
        weekCounts[2]++;
      } else if (diffDays <= 21) {
        weekCounts[1]++;
      } else if (diffDays <= 28) {
        weekCounts[0]++;
      }
    });

    const sortedCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 3);

    let aiInsight = null;
    try {
      const topWardName = byWard[0]?.ward || 'Pune West';
      aiInsight = await generatePredictiveInsight({
        ward_name: topWardName,
        issue_counts_by_week: weekCounts,
        top_categories: sortedCategories,
        avg_severity: Number(avgSeverity.toFixed(1))
      });
    } catch (geminiErr) {
      console.warn('Failed to generate predictive AI insight from Gemini API, using mock fallback:', geminiErr);
      // Fallback predictive insight matching target JSON structure
      aiInsight = {
        hotspot_wards: [
          { ward: byWard[0]?.ward || 'Pune West', risk_level: 'high', reason: 'Rising category concentration and high average severity.' },
          { ward: byWard[1]?.ward || 'Camp', risk_level: 'medium', reason: 'High unresolved streetlight reports.' }
        ],
        prediction: 'Based on weekly filing trends, pothole reports are predicted to rise by 15% in Pune West due to infrastructure wear.',
        recommended_action: 'Allocate structural repair crews to Pune West hotspots within the next 48 hours.'
      };
    }

    const payload = {
      overall: {
        total_reports,
        open_count,
        in_progress_count,
        resolved_count,
        resolution_rate,
        avg_resolution_hours
      },
      byCategory,
      byWard,
      health: {
        overall: overallHealth,
        wards: wardHealthScores
      },
      trend,
      heroes: enrichedHeroes,
      insight: aiInsight
    };

    // Cache the response
    cachedStats = payload;
    cacheTime = now;

    return NextResponse.json(payload);
  } catch (err) {
    console.error('API GET Dashboard Stats Error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
