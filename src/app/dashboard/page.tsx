'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
} from 'recharts';
import {
  Activity,
  Award,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  MapPin,
  ArrowRight,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';

interface DashboardData {
  overall: {
    total_reports: number;
    open_count: number;
    in_progress_count: number;
    resolved_count: number;
    resolution_rate: number;
    avg_resolution_hours: number;
  };
  byCategory: Record<string, number>;
  byWard: { ward: string; open_issues_count: number }[];
  health: {
    overall: { score: number; status: string };
    wards: { ward: string; score: number; status: string; open_issues: number }[];
  };
  trend: { date: string; count: number }[];
  heroes: {
    user_id: string;
    points: number;
    reports_count: number;
    verifications_count: number;
    badge_level: string;
    displayName: string;
  }[];
  insight: {
    hotspot_wards: { ward: string; risk_level: 'high' | 'medium' | 'low'; reason: string }[];
    prediction: string;
    recommended_action: string;
  };
}

const getCategoryColor = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('pothole') || n.includes('road')) return '#E74C3C'; // Red
  if (n.includes('streetlight')) return '#F39C12'; // Amber
  if (n.includes('water')) return '#2563eb'; // Blue
  if (n.includes('garbage')) return '#27AE60'; // Green
  return '#717881'; // Gray
};

export default function AccountabilityDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const stats = await res.json();
        setData(stats);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // 1. Fetch on load and set auto-refresh interval
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStats();
    }, 0);
    const interval = setInterval(() => {
      fetchStats(true);
    }, 60000); // 60s auto-refresh
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // Show loading skeletons if loading initially
  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background p-6 font-body-md text-on-background animate-pulse flex flex-col gap-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
        {/* Metric cards skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-surface-container-lowest border border-surface-border rounded-lg p-6 h-28"></div>
          ))}
        </div>
        {/* Chart row skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-container-lowest border border-surface-border rounded-lg p-6 h-80"></div>
          <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-6 h-80"></div>
        </div>
        {/* Health cards skeleton */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-6 h-48"></div>
      </div>
    );
  }

  // Formatting chart data structures
  const barChartData = Object.entries(data.byCategory || {}).map(([name, count]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    count,
  }));

  const pieChartData = [
    { name: 'Open', value: data.overall.open_count, color: '#E74C3C' },
    { name: 'In Progress', value: data.overall.in_progress_count, color: '#F39C12' },
    { name: 'Resolved', value: data.overall.resolved_count, color: '#27AE60' },
  ].filter((item) => item.value > 0);

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRiskColor = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'high':
        return 'bg-error/10 text-error border-error/20';
      case 'medium':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'low':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md flex flex-col relative">
      {/* Font loaders */}
      <link href="https://fonts.googleapis.com" rel="preconnect" />
      <link href="https://fonts.gstatic.com" rel="preconnect" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

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
      </nav>

      {/* Main Content Dashboard */}
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      
      {/* Title & Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-surface-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary dark:text-inverse-primary">
            Smart City Accountability Dashboard
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Real-time public performance tracking and municipal issue analytics for Pune.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container rounded-full px-3 py-1.5 border border-surface-border">
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Auto-refreshing every 60s</span>
        </div>
      </header>

      {/* Row 1: Stat Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">Total Reports</span>
            <strong className="text-2xl font-bold text-on-surface">{data.overall.total_reports}</strong>
            <span className="text-[10px] text-success block mt-0.5">Community initiatives active</span>
          </div>
        </div>
        {/* Card 2 */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center text-error">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">Open Issues</span>
            <strong className="text-2xl font-bold text-on-surface">{data.overall.open_count}</strong>
            <span className="text-[10px] text-on-surface-variant block mt-0.5">{data.overall.in_progress_count} currently in progress</span>
          </div>
        </div>
        {/* Card 3 */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center text-success">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">Resolution Rate</span>
            <strong className="text-2xl font-bold text-on-surface">{data.overall.resolution_rate}%</strong>
            <span className="text-[10px] text-success block mt-0.5">{data.overall.resolved_count} issues resolved total</span>
          </div>
        </div>
        {/* Card 4 */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center text-warning">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">Avg Resolution Time</span>
            <strong className="text-2xl font-bold text-on-surface">{data.overall.avg_resolution_hours} hrs</strong>
            <span className="text-[10px] text-on-surface-variant block mt-0.5">Municipal targets: 48 hrs</span>
          </div>
        </div>
      </section>

      {/* Row 2: Charts (Category breakdown & Status donut) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown (60%) */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 border-b border-surface-border pb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-on-surface">Issues by Category (All-Time)</h2>
          </div>
          <div className="w-full h-80">
            {barChartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-on-surface-variant">No report history.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {barChartData.map((entry, idx) => (
                      <Cell key={idx} fill={getCategoryColor(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Distribution (40%) */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 border-b border-surface-border pb-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-on-surface">Status Distribution</h2>
          </div>
          <div className="w-full h-80 flex flex-col justify-center items-center relative">
            {pieChartData.length === 0 ? (
              <div className="text-xs text-on-surface-variant">No active data.</div>
            ) : (
              <>
                <div className="w-full h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend list */}
                <div className="flex justify-center gap-4 text-xs font-semibold mt-2">
                  {pieChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span>{item.name} ({item.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Row 3: Civic Health Score Per Ward */}
      <section className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-success" />
            <h2 className="font-bold text-base text-on-surface">Ward Civic Health Rankings</h2>
          </div>
          <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full border border-surface-border font-semibold">
            Pune Overall Health: <strong className="text-warning">{data.health.overall.score}/100</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {data.health.wards.slice(0, 8).map((wardScore) => {
            const isGood = wardScore.score > 70;
            const isBad = wardScore.score < 40;
            const scoreColor = isGood ? 'text-success' : isBad ? 'text-error' : 'text-warning';
            
            return (
              <div
                key={wardScore.ward}
                onClick={() => router.push(`/map?ward=${encodeURIComponent(wardScore.ward)}`)}
                className="bg-surface-container-lowest border border-surface-border rounded-lg p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all flex flex-col gap-2 relative group"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-on-surface-variant" />
                    {wardScore.ward}
                  </h3>
                  {isGood ? (
                    <TrendingUp className="w-4 h-4 text-success" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-error" />
                  )}
                </div>
                
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold ${scoreColor}`}>
                    {wardScore.score}
                  </span>
                  <span className="text-xs text-on-surface-variant">/ 100</span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-on-surface-variant mt-2 border-t border-surface-border pt-2">
                  <span>{wardScore.open_issues} active issues</span>
                  <span className="flex items-center gap-0.5 group-hover:translate-x-1 duration-150 transition-transform">
                    Zoom Map
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Row 4: AI Predictive Insight Panel */}
      {data.insight && (
        <section className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-surface-border pb-3">
            <Brain className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-base text-on-surface">AI Predictive Analysis (Gemini Flash)</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Highlighted AI Blue Card */}
            <div className="lg:col-span-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-5 flex flex-col gap-3">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <Brain className="w-4 h-4" />
                AI Predictor Insight
              </span>
              <p className="text-sm font-semibold text-on-surface leading-relaxed italic">
                &ldquo;{data.insight.prediction}&rdquo;
              </p>
              <div className="mt-2 bg-indigo-100/50 dark:bg-indigo-900/30 rounded p-3 border border-indigo-200/50 text-xs">
                <strong>Recommended Action:</strong> {data.insight.recommended_action}
              </div>
            </div>

            {/* Hotspot risk badges */}
            <div className="bg-surface-container border border-surface-border rounded-lg p-5 flex flex-col gap-4">
              <h3 className="font-bold text-xs text-on-surface-variant uppercase tracking-wider">
                Predicted Hotspots Wards
              </h3>
              <div className="flex flex-col gap-3">
                {data.insight.hotspot_wards.map((hotspot, idx) => (
                  <div 
                    key={idx} 
                    className="flex flex-col gap-1 border-b border-surface-border last:border-0 pb-2 last:pb-0"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-on-surface">{hotspot.ward}</span>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 border rounded-full ${getRiskColor(hotspot.risk_level)}`}>
                        {hotspot.risk_level} Risk
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">{hotspot.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Row 5: CivicHero Leaderboard */}
      <section className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-border pb-3">
          <Award className="w-5 h-5 text-warning" />
          <h2 className="font-bold text-base text-on-surface">CivicHero Community Leaderboard</h2>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-border text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4 w-16">Rank</th>
                <th className="py-3 px-4">Hero Name</th>
                <th className="py-3 px-4 text-center">Civic Points</th>
                <th className="py-3 px-4 text-center">Reports Filed</th>
                <th className="py-3 px-4 text-center">Verifications Completed</th>
                <th className="py-3 px-4 text-right">Civic Badge Level</th>
              </tr>
            </thead>
            <tbody>
              {data.heroes.map((hero, index) => {
                const rank = index + 1;
                const initials = getInitials(hero.displayName);
                const rankColors = [
                  'bg-warning/20 text-warning border-warning/30',
                  'bg-slate-200 text-slate-800 border-slate-300',
                  'bg-orange-100 text-orange-800 border-orange-200'
                ];
                const rankClass = rankColors[index] || 'bg-surface-container text-on-surface-variant border-surface-border';

                return (
                  <tr 
                    key={hero.user_id} 
                    className="border-b border-surface-border last:border-0 hover:bg-surface-container-low/30 transition-colors font-medium text-on-surface"
                  >
                    <td className="py-4 px-4">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${rankClass}`}>
                        #{rank}
                      </span>
                    </td>
                    <td className="py-4 px-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                        {initials}
                      </div>
                      <span className="font-semibold text-sm">{hero.displayName}</span>
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-sm text-primary">
                      {hero.points} pts
                    </td>
                    <td className="py-4 px-4 text-center text-on-surface-variant font-semibold">
                      {hero.reports_count}
                    </td>
                    <td className="py-4 px-4 text-center text-on-surface-variant font-semibold">
                      {hero.verifications_count}
                    </td>
                    <td className="py-4 px-4 text-right font-bold">
                      <span className="text-[10px] bg-primary-container text-on-primary-container py-1 px-2.5 rounded-full border border-primary/15 shadow-sm">
                        {hero.badge_level}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 6: Sparkline Trends (Last 7 days reported counts) */}
      <section className="bg-surface-container-lowest border border-surface-border rounded-lg p-5 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-on-surface">Weekly Intake Activity Trend</h2>
          </div>
          <span className="text-[11px] text-on-surface-variant font-semibold">
            Last 7 days reported counts
          </span>
        </div>

        <div className="w-full h-40 mt-2">
          {data.trend.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-on-surface-variant">No recent activity.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(str) => {
                    const parts = str.split('-');
                    return parts[2] ? `${parts[2]}/${parts[1]}` : str;
                  }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#005387" 
                  strokeWidth={2.5} 
                  dot={{ r: 4, strokeWidth: 1.5, fill: '#FFFFFF' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      </div>
    </div>
  );
}
