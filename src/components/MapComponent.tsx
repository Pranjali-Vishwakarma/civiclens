'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon rendering in Next.js SSR/bundling contexts
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/marker-icon-2x.png',
    iconUrl: '/marker-icon.png',
    shadowUrl: '/marker-shadow.png',
  });
}

import { Issue } from '@/types';

// Category color mapping
const getCategoryColor = (category: string): string => {
  const cat = category.toLowerCase();
  if (cat === 'pothole' || cat === 'road_damage') return '#E74C3C'; // Red
  if (cat === 'streetlight') return '#F39C12'; // Amber
  if (cat === 'water' || cat === 'water_leak') return '#2563eb'; // Blue
  if (cat === 'garbage') return '#27AE60'; // Green
  return '#6B7280'; // Gray (other)
};

// Inline SVG pin + circle creator
const createMarkerIconHtml = (category: string, isFilteredOut: boolean, isNew = false) => {
  const color = getCategoryColor(category);
  const opacity = isFilteredOut ? 0.2 : 1.0;
  
  // Custom pulse animation for new real-time pins
  const pulseClass = isNew ? 'animate-pulse' : '';

  return `
    <div style="opacity: ${opacity}; transition: opacity 0.2s;" class="${pulseClass}">
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16 0 0 7.16 0 16C0 27.5 16 42 16 42C16 42 32 27.5 32 16C32 7.16 24.84 0 16 0ZM16 22C12.69 22 10 19.31 10 16C10 12.69 12.69 10 16 10C19.31 10 22 12.69 22 16C22 19.31 19.31 22 16 22Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
        <circle cx="16" cy="16" r="4" fill="#FFFFFF"/>
      </svg>
    </div>
  `;
};

// Controller to dynamically pan the map center
function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface MapComponentProps {
  issues: Issue[];
  activeFilter: string;
  onVerify: (id: string, verdict: 'confirm' | 'dispute') => void;
  userLocation: { lat: number; lng: number } | null;
  newIssueIds: string[]; // List of IDs that are new to animate
  userVotes: Record<string, 'confirm' | 'dispute'>;
  onResetVote: (id: string) => void;
}

// Bounding box filter helper matching the GET API rules
const isFilterMatch = (filter: string, category: string) => {
  if (filter === 'All') return true;
  const cleanFilter = filter.toLowerCase().replace(/s$/, ''); // potholes -> pothole
  if (cleanFilter === 'water' && category === 'water_leak') return true;
  if (cleanFilter === 'pothole' && category === 'road_damage') return true;
  return cleanFilter === category.toLowerCase();
};

export default function MapComponent({ 
  issues, 
  activeFilter, 
  onVerify, 
  userLocation,
  newIssueIds,
  userVotes,
  onResetVote
}: MapComponentProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-container-low text-on-surface-variant font-body-md">
        Loading Map Dashboard...
      </div>
    );
  }

  // Default center is Pune coordinates
  const defaultCenter: [number, number] = userLocation 
    ? [userLocation.lat, userLocation.lng] 
    : [18.5204, 73.8567];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      scrollWheelZoom={true}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLocation && (
        <MapCenterController center={[userLocation.lat, userLocation.lng]} />
      )}

      {issues.map((issue) => {
        const isFilteredOut = !isFilterMatch(activeFilter, issue.category);
        const isNew = newIssueIds.includes(issue.id);

        const customIcon = L.divIcon({
          html: createMarkerIconHtml(issue.category, isFilteredOut, isNew),
          className: 'custom-leaflet-marker',
          iconSize: [32, 42],
          iconAnchor: [16, 42],
          popupAnchor: [0, -40],
        });

        // Determine status tag style class
        const statusColors: Record<string, string> = {
          open: 'bg-error/10 text-error',
          in_progress: 'bg-warning/10 text-warning',
          resolved: 'bg-success/10 text-success',
        };

        const imageSrc = issue.photo_urls?.[0] && !issue.photo_urls[0].includes('...[truncated]')
          ? issue.photo_urls[0]
          : null;

        return (
          <Marker 
            key={issue.id} 
            position={[issue.lat, issue.lng]} 
            icon={customIcon}
            opacity={isFilteredOut ? 0.2 : 1.0}
          >
            <Popup className="civic-map-popup">
              <div className="p-3 bg-surface-container-lowest text-on-surface rounded-lg min-w-[220px] font-sans">
                {issue.verified_at && (
                  <div className="mb-2 bg-success/15 border border-success/35 text-success rounded py-1 px-2.5 text-[10px] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    Community Verified
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold bg-primary-container text-on-primary-container px-2 py-0.5 rounded capitalize">
                    {issue.category}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColors[issue.status] || 'bg-slate-100 text-slate-650'}`}>
                    {issue.status.replace('_', ' ')}
                  </span>
                </div>
                
                <h4 className="font-bold text-sm text-on-surface mb-1 line-clamp-1">{issue.title}</h4>
                <p className="text-xs text-on-surface-variant line-clamp-2 mb-2 leading-relaxed">{issue.description}</p>
                
                {imageSrc && (
                  <div className="w-full h-24 rounded overflow-hidden border border-surface-border mb-3">
                    <img className="w-full h-full object-cover" alt={issue.title} src={imageSrc} />
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-2">
                  <span>Severity: <strong className="text-on-surface">{issue.severity}/5</strong></span>
                  <span>Upvotes: <strong>{issue.upvotes}</strong></span>
                </div>

                <div className="border-t border-surface-border mt-3 pt-3 flex flex-col gap-2">
                  {userVotes[issue.id] ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-on-surface-variant italic font-semibold">
                        You {userVotes[issue.id] === 'confirm' ? 'confirmed' : 'disputed'} this report.
                      </span>
                      <button
                        onClick={() => onResetVote(issue.id)}
                        className="text-[10px] text-primary hover:underline text-left font-bold"
                      >
                        Change my response
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-bold">
                        <span>Verify this report:</span>
                        <span>{issue.upvotes || 0} neighbors confirmed</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onVerify(issue.id, 'confirm')}
                          disabled={issue.status === 'resolved'}
                          className="flex-1 bg-success hover:bg-success/90 disabled:opacity-50 text-on-primary rounded py-1 px-2 font-label-md text-[10px] flex items-center justify-center gap-0.5 active:scale-95 duration-100"
                        >
                          <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                          Confirm I saw this
                        </button>
                        <button
                          onClick={() => onVerify(issue.id, 'dispute')}
                          disabled={issue.status === 'resolved'}
                          className="bg-surface-variant hover:bg-surface-container-high disabled:opacity-50 text-on-surface-variant rounded py-1 px-2 font-label-md text-[10px] flex items-center justify-center gap-0.5 active:scale-95 duration-100"
                        >
                          <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                          Looks different
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
