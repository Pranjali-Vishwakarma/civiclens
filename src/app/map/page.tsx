'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './map.module.css';
import { useIssuesRealtime } from '@/lib/supabase-realtime';
import { Issue } from '@/types';

// Dynamically import MapComponent to disable server-side rendering for Leaflet map
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-200">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm font-semibold">Loading Map Engine...</p>
      </div>
    </div>
  ),
});

// Helper for filtering matching issues (same as used in MapComponent)
const isFilterMatch = (filter: string, category: string) => {
  if (filter === 'All') return true;
  const cleanFilter = filter.toLowerCase().replace(/s$/, ''); // potholes -> pothole
  if (cleanFilter === 'water' && category === 'water_leak') return true;
  if (cleanFilter === 'pothole' && category === 'road_damage') return true;
  return cleanFilter === category.toLowerCase();
};

export default function MapDashboardPage() {
  const router = useRouter();

  // Core Data States
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // UI Interactive States
  const [activeFilter, setActiveFilter] = useState('All');
  const [newIssueIds, setNewIssueIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, 'confirm' | 'dispute'>>({});

  // 1. Fetch initial issues and load user location hint
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch('/api/issues');
        if (response.ok) {
          const data = await response.json();
          setIssues(data.issues || []);
        }
      } catch (err) {
        console.error('Failed to load initial issues:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Attempt user geolocation for map focus
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => console.log('Using default Pune center')
      );
    }

    fetchInitialData();
  }, []);

  // 2. Realtime issues listener
  useIssuesRealtime((newIssue) => {
    // Prevent duplicate entries
    setIssues((prev) => {
      if (prev.some((issue) => issue.id === newIssue.id)) return prev;
      return [newIssue, ...prev];
    });

    // Add to animation list for a brief 2-second pulse on the map
    setNewIssueIds((prev) => [...prev, newIssue.id]);
    setTimeout(() => {
      setNewIssueIds((prev) => prev.filter((id) => id !== newIssue.id));
    }, 2000);

    // Trigger toast notification
    setToast(`New report in ${newIssue.ward_name || 'your community'}`);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  });

  // 3. Upvote/Verify report click handler
  const handleVerifyIssue = async (issueId: string, verdict: 'confirm' | 'dispute') => {
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId, verdict }),
      });
      if (response.ok) {
        const resData = await response.json();
        // Optimistically increment upvote count in state
        setIssues((prev) =>
          prev.map((i) => {
            if (i.id === issueId) {
              const updated = { ...i, upvotes: (i.upvotes || 0) + 1 };
              if (resData.isVerified) {
                updated.verified_at = new Date().toISOString();
              }
              return updated;
            }
            return i;
          })
        );
        setUserVotes((prev) => ({ ...prev, [issueId]: verdict }));
      }
    } catch (err) {
      console.error('Verify error:', err);
    }
  };

  const handleResetVote = (issueId: string) => {
    setUserVotes((prev) => {
      const copy = { ...prev };
      delete copy[issueId];
      return copy;
    });
  };

  // 4. Dynamic Civic Health calculations based on current dataset
  const totalCount = issues.length;
  const resolvedCount = issues.filter((i) => i.status === 'resolved').length;
  const openCount = issues.filter((i) => i.status === 'open' || i.status === 'in_progress').length;

  const civicHealthScore = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;
  const openPercent = totalCount > 0 ? Math.round((openCount / totalCount) * 100) : 0;
  const resolvedPercent = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;

  // Filter list of issues to display in the sidebar
  const visibleSidebarIssues = issues.filter((issue) => 
    isFilterMatch(activeFilter, issue.category)
  );

  return (
    <div className="bg-background h-screen w-screen overflow-hidden text-on-background font-body-md flex flex-col relative">
      {/* Font loaders */}
      <link href="https://fonts.googleapis.com" rel="preconnect" />
      <link href="https://fonts.gstatic.com" rel="preconnect" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* Realtime Toast Banner */}
      {toast && (
        <div className="absolute top-20 right-6 z-[100] bg-inverse-surface text-inverse-on-surface shadow-2xl rounded-lg py-3 px-5 border border-outline flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
            notifications_active
          </span>
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Top NavBar */}
      <nav className="bg-surface-container-lowest dark:bg-inverse-surface border-b border-surface-border dark:border-outline-variant flex justify-between items-center w-full px-margin-desktop z-50 h-[56px] shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link 
            href="/"
            className="text-primary dark:text-primary-fixed-dim hover:bg-surface-container-low transition-colors p-1.5 rounded-full active:scale-95 duration-150 flex items-center justify-center mr-1"
          >
            <span className="material-symbols-outlined" data-icon="arrow_back">arrow_back</span>
          </Link>
          <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
            location_on
          </span>
          <span className="font-headline-sm text-headline-sm font-bold text-primary dark:text-inverse-primary">
            CivicLens
          </span>
        </div>

        {/* Filters */}
        <div className="hidden md:flex items-center gap-2">
          {['All', 'Potholes', 'Streetlights', 'Water', 'Garbage'].map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-1.5 rounded-full font-body-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-bold border-b-2 border-primary dark:border-inverse-primary opacity-80 scale-95'
                    : 'border border-surface-border text-on-surface-variant hover:text-primary dark:hover:text-inverse-primary text-on-surface-variant dark:text-surface-variant'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Trailing Actions */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/report')}
            className="bg-primary-container text-on-primary px-4 py-2 rounded-DEFAULT font-body-sm font-bold hover:opacity-90 active:scale-95 duration-100 transition-transform"
          >
            Report issue
          </button>
          <div className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden border border-surface-border">
            <img 
              alt="User avatar" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWwMulTxPR08kGwD_vwpzSLzWhARCuiL0GxA3sJwjmrYJ9Rbc-i6s8Pj9QGunu7cQ7ZB8FlG_uKb9YAWEvPTI9wnPI3iCE_5P6aVEvwPVpPk-JBVvshcKor01DD3rxtVTA19qRiH5ZFcIQMJGFNHwkngy21U7Jr5KzeOUs3V7rjtWRR-TzOjhajmq5OcWHt8fsqMUhGPFKOa141IIK8fGqJmYBYnS_tKXBsIsvvLZMENLUFuavjsYHWG3oekgHjvBSU9JepWj8BjQa"
            />
          </div>
        </div>
      </nav>

      {/* Split Content layout */}
      <div className="flex flex-1 w-full overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-[320px] bg-surface-container-lowest border-r border-surface-border h-full flex flex-col z-40 shrink-0 hidden md:flex overflow-hidden">
          <div className="p-4 border-b border-surface-border flex justify-between items-center bg-surface-container-lowest z-10 shrink-0">
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Recent reports</h2>
            <span className="bg-surface-variant text-on-surface-variant font-label-md px-2 py-1 rounded-full">
              {visibleSidebarIssues.length}
            </span>
          </div>

          {/* Loading Skeleton */}
          {isLoading ? (
            <div className="flex-1 p-4 flex flex-col gap-4 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-surface-container-low border border-surface-border rounded-lg p-4 h-32 flex flex-col justify-center gap-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-5/6 mt-2"></div>
                </div>
              ))}
            </div>
          ) : (
            /* Issues Cards List */
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {visibleSidebarIssues.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant text-xs">
                  No issues found matching filter.
                </div>
              ) : (
                visibleSidebarIssues.map((issue) => {
                  const statusColors: Record<string, string> = {
                    open: 'bg-danger/10 text-danger',
                    in_progress: 'bg-warning/10 text-warning',
                    resolved: 'bg-success/10 text-success',
                  };

                  return (
                    <div 
                      key={issue.id} 
                      className="bg-surface-container-lowest border border-surface-border rounded-lg p-4 cursor-pointer hover:border-primary-container transition-colors shadow-sm"
                    >
                      {issue.verified_at && (
                        <div className="mb-2 bg-success/15 border border-success/35 text-success rounded-full py-0.5 px-2 text-[9px] font-bold w-fit flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          Community Verified
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="font-headline-md text-body-md font-bold text-on-surface line-clamp-1">
                          {issue.title}
                        </h3>
                        <span className={`${statusColors[issue.status] || 'bg-slate-100 text-slate-700'} px-2 py-0.5 rounded font-label-md whitespace-nowrap text-[10px]`}>
                          {issue.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-on-surface-variant font-body-sm mb-3 text-xs">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        <span>{issue.ward_name || 'N/A'}</span>
                        <span>•</span>
                        <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                        <span className="text-on-surface-variant font-body-sm text-xs">Severity</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((lvl) => (
                            <div 
                              key={lvl}
                              className={`w-2 h-2 rounded-full ${
                                lvl <= issue.severity 
                                  ? (issue.status === 'in_progress' ? 'bg-warning' : (issue.status === 'resolved' ? 'bg-success' : 'bg-danger'))
                                  : 'bg-surface-variant'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </aside>

        {/* Main Map Area Canvas */}
        <main className={`flex-1 relative h-full overflow-hidden ${styles.mapBg}`}>
          
          {/* Dynamically Loaded MapComponent */}
          <MapComponent 
            issues={issues}
            activeFilter={activeFilter}
            onVerify={handleVerifyIssue}
            userLocation={userLocation}
            newIssueIds={newIssueIds}
            userVotes={userVotes}
            onResetVote={handleResetVote}
          />

          {/* Floating Health Score Card */}
          <div className="absolute bottom-6 right-6 w-[220px] bg-surface-container-lowest border border-surface-border rounded-xl p-5 shadow-lg z-20 pointer-events-auto">
            <h4 className="font-label-md text-on-surface-variant mb-1 uppercase tracking-wide">Civic health score</h4>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-headline-xl text-headline-xl font-bold text-warning">
                {civicHealthScore}
              </span>
              <span className="font-body-sm text-on-surface-variant">/ 100</span>
            </div>
            <p className="font-body-sm text-on-surface mb-4">Current Ward</p>
            <div className="flex justify-between font-label-md text-on-surface-variant mb-1 text-xs">
              <span>Open</span>
              <span>Resolved</span>
            </div>
            {/* Health track split bar */}
            <div className="w-full h-2 rounded-full bg-surface-variant overflow-hidden flex">
              <div className="h-full bg-danger" style={{ width: `${openPercent}%` }} />
              <div className="h-full bg-success" style={{ width: `${resolvedPercent}%` }} />
            </div>
          </div>

          {/* Floating Action Button */}
          <button 
            onClick={() => router.push('/report')}
            className="absolute bottom-6 left-6 w-14 h-14 bg-primary-container text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-20"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
          </button>

        </main>
      </div>
    </div>
  );
}
