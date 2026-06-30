import { useEffect } from 'react';
import { supabase } from './supabase-client';
import { Issue } from '@/types';

/**
 * Custom React hook that subscribes to real-time updates on the Supabase 'issues' table.
 * Listens for new inserts and fires the provided callback.
 * 
 * @param onNewIssue - Callback function triggered when a new issue is submitted.
 */
export function useIssuesRealtime(onNewIssue: (issue: Issue) => void) {
  useEffect(() => {
    // Initialize channel subscription for PostgreSQL changes
    const channel = supabase
      .channel('realtime-issues')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issues',
        },
        (payload) => {
          if (payload.new) {
            onNewIssue(payload.new as Issue);
          }
        }
      )
      .subscribe();

    // Clean up channel subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewIssue]);
}
