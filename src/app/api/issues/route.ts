import { NextResponse } from 'next/server';
import { createApiServerClient } from '@/lib/supabase';
import { getLocalIssues } from '@/lib/temp-db';
import { Issue } from '@/types';

// Helper to check if a coordinate falls within a bounding box
function isWithinBounds(lat: number, lng: number, lat1: number, lng1: number, lat2: number, lng2: number) {
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  const minLng = Math.min(lng1, lng2);
  const maxLng = Math.max(lng1, lng2);
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // open|in_progress|resolved
    const category = searchParams.get('category');
    const bounds = searchParams.get('bounds'); // 'lat1,lng1,lat2,lng2'
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    let issues: Issue[] = [];
    const stats = {
      total: 0,
      open: 0,
      resolved: 0,
      byCategory: {} as Record<string, number>,
    };

    let loadedFromDb = false;

    // Try fetching from Supabase
    try {
      const supabase = await createApiServerClient();

      // 1. Fetch global status/category counts for statistics
      const { data: statsRows, error: statsError } = await supabase
        .from('issues')
        .select('status, category');

      if (!statsError && statsRows) {
        stats.total = statsRows.length;
        stats.open = statsRows.filter((r) => r.status === 'open').length;
        stats.resolved = statsRows.filter((r) => r.status === 'resolved').length;
        
        statsRows.forEach((row) => {
          if (row.category) {
            stats.byCategory[row.category] = (stats.byCategory[row.category] || 0) + 1;
          }
        });
      }

      // 2. Query issues matching filters
      if (bounds) {
        const [lat1, lng1, lat2, lng2] = bounds.split(',').map(Number);
        
        if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
          // Attempt using custom RPC PostGIS bounding box check
          const { data: rpcData, error: rpcError } = await supabase.rpc('fetch_issues', {
            status_filter: status || null,
            category_filter: category || null,
            lat1,
            lng1,
            lat2,
            lng2,
            lim: limit,
          });

          if (!rpcError && rpcData) {
            issues = rpcData;
            loadedFromDb = true;
          } else {
            console.warn('Supabase fetch_issues RPC failed, fallback to client filtering:', rpcError);
            
            // Client-side fallback: fetch standard filtered and perform bounding box filter in JS
            let query = supabase.from('issues').select('*');
            if (status) query = query.eq('status', status);
            if (category) query = query.eq('category', category);
            
            const { data: queryData, error: queryError } = await query
              .order('created_at', { ascending: false })
              .limit(limit);

            if (!queryError && queryData) {
              issues = queryData.filter((i) => isWithinBounds(i.lat, i.lng, lat1, lng1, lat2, lng2));
              loadedFromDb = true;
            }
          }
        }
      } else {
        // Simple filter without bounds
        let query = supabase.from('issues').select('*');
        if (status) query = query.eq('status', status);
        if (category) query = query.eq('category', category);
        
        const { data: dbIssues, error: queryError } = await query
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!queryError && dbIssues) {
          issues = dbIssues;
          loadedFromDb = true;
        }
      }
    } catch (supabaseError) {
      console.warn('Supabase database connection failed, falling back to local file storage:', supabaseError);
    }

    // Local JSON filesystem fallback
    if (!loadedFromDb) {
      const localIssues = getLocalIssues();

      // Compile stats globally
      stats.total = localIssues.length;
      stats.open = localIssues.filter((i) => i.status === 'open').length;
      stats.resolved = localIssues.filter((i) => i.status === 'resolved').length;
      
      localIssues.forEach((issue) => {
        stats.byCategory[issue.category] = (stats.byCategory[issue.category] || 0) + 1;
      });

      // Filter issues list
      let filtered = [...localIssues];

      if (status) {
        filtered = filtered.filter((i) => i.status === status);
      }
      if (category) {
        filtered = filtered.filter((i) => i.category === category);
      }
      if (bounds) {
        const [lat1, lng1, lat2, lng2] = bounds.split(',').map(Number);
        if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
          filtered = filtered.filter((i) => isWithinBounds(i.lat, i.lng, lat1, lng1, lat2, lng2));
        }
      }

      // Limit and sort by created_at desc
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      issues = filtered.slice(0, limit);
    }

    return NextResponse.json({
      issues,
      stats,
    });
  } catch (err) {
    console.error('API GET Issues Error:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
