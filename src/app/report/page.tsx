'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './report.module.css';
import { compressImageToBase64 } from '@/lib/gemini';
import { Issue } from '@/types';

interface GeminiAnalysis {
  category: 'pothole' | 'streetlight' | 'water_leak' | 'garbage' | 'road_damage' | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  suggested_department: string;
  confidence: number;
  is_infrastructure_issue: boolean;
}

export default function ReportPage() {
  // Geolocation & Form state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Getting location...');
  const [optionalNotes, setOptionalNotes] = useState('');

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');

  // AI & API States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysis | null>(null);
  
  // Custom manual overrides / edits
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState(0);

  // Submission / Flow States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<Issue[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedIssueId, setSubmittedIssueId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Geolocation loading on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationStatus('Using your current location');
        },
        (error) => {
          console.warn('Geolocation retrieval failed:', error.message || error.code || String(error));
          setUserLocation({
            lat: 18.5204,
            lng: 73.8567,
          });
          setLocationStatus('Using default location (Pune Center)');
        }
      );
    } else {
      const timer = setTimeout(() => {
        setUserLocation({
          lat: 18.5204,
          lng: 73.8567,
        });
        setLocationStatus('Using default location (Pune Center)');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // 2. Image selection & auto-analysis
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error & warning states
    setErrorMsg(null);
    setDuplicates(null);

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Set loading states
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      if (!userLocation) {
        throw new Error('Location coordinates must be loaded first before performing AI analysis.');
      }

      // Compress client-side
      const compressed = await compressImageToBase64(file);
      setImageBase64(compressed.base64);
      setMimeType(compressed.mimeType);

      // Call API in analyzeOnly mode
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          lat: userLocation.lat,
          lng: userLocation.lng,
          additionalNotes: optionalNotes,
          analyzeOnly: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server error occurred during photo analysis.');
      }

      const analysis: GeminiAnalysis = data.geminiAnalysis;
      setAnalysisResult(analysis);
      
      // Auto-fill editable form states
      setTitle(analysis.title);
      setDescription(analysis.description);
      setCategory(analysis.category);
      setSeverity(analysis.severity);

    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to analyze photo.';
      setErrorMsg(msg);
      setImagePreview(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Reset file/photo
  const handleClearPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImagePreview(null);
    setImageBase64(null);
    setAnalysisResult(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setSeverity(0);
    setDuplicates(null);
    setErrorMsg(null);
  };

  // 3. Form Submit logic
  const handleSubmitReport = async (forceSubmit = false) => {
    if (!imageBase64 || !userLocation) {
      setErrorMsg('Image photo and location coordinates are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload = {
      imageBase64,
      mimeType,
      lat: userLocation.lat,
      lng: userLocation.lng,
      additionalNotes: optionalNotes,
      // Pass manual updates if changed, otherwise use Gemini results
      title: title || (analysisResult?.title ?? 'Civic Issue'),
      description: description || (analysisResult?.description ?? ''),
      category: category || (analysisResult?.category ?? 'other'),
      severity: severity || (analysisResult?.severity ?? 3),
      force_submit: forceSubmit,
    };

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit the report.');
      }

      // Check duplicates match
      if (data.duplicate) {
        setDuplicates(data.existingIssues);
        setIsSubmitting(false);
        return;
      }

      // Success
      setSubmittedIssueId(data.issue.id);
      setSubmitted(true);
      setDuplicates(null);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to submit report.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add support to upvote/verify an existing duplicate instead of making new
  const handleVerifyDuplicate = async (issueId: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upvote report.');
      }

      // Show success screen indicating verification
      setSubmittedIssueId(issueId);
      setSubmitted(true);
      setDuplicates(null);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to link verification.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Success Screen
  if (submitted) {
    return (
      <div className={`bg-surface-container-lowest text-on-surface font-body-md-mobile antialiased flex items-center justify-center min-h-screen ${styles.container}`}>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        
        <div className="w-full max-w-[480px] bg-background shadow-xl rounded-2xl p-lg flex flex-col items-center justify-center text-center gap-lg border border-outline-variant">
          <div className="w-20 h-20 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-4xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>
          <div>
            <h2 className="text-display-lg font-bold text-primary mb-2">Report Submitted!</h2>
            <p className="text-on-surface-variant text-body-md max-w-xs mx-auto">
              Report <span className="font-mono font-bold text-on-surface">#{submittedIssueId?.slice(0, 8)}</span> submitted.
            </p>
          </div>
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md w-full">
            <span className="text-secondary font-semibold text-body-lg block">+10 civic points earned!</span>
            <span className="text-xs text-on-surface-variant block mt-1">Thank you for contributing to your community.</span>
          </div>
          <button 
            onClick={() => {
              setSubmitted(false);
              setSubmittedIssueId(null);
              setImagePreview(null);
              setOptionalNotes('');
              setTitle('');
              setDescription('');
              setCategory('');
              setSeverity(0);
            }}
            className="w-full bg-primary text-on-primary rounded-lg py-3 font-label-md hover:bg-primary-container transition-colors shadow-sm active:scale-95 duration-150"
          >
            Report Another Issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface-container-lowest text-on-surface font-body-md-mobile antialiased flex justify-center min-h-screen ${styles.container}`}>
      {/* Load Material Symbols Outlined Font */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div className="w-full max-w-[480px] bg-background shadow-sm relative flex flex-col min-h-screen pb-36">
        
        {/* TopAppBar */}
        <header className="flex items-center justify-between px-container-margin h-16 w-full z-50 bg-background dark:bg-surface-dim shadow-sm border-b border-outline-variant dark:border-outline fixed top-0 max-w-[480px]">
          <Link 
            href="/"
            className="text-primary dark:text-primary-fixed-dim hover:bg-surface-container-low transition-colors p-2 rounded-full active:scale-95 duration-150 flex items-center justify-center"
          >
            <span className="material-symbols-outlined" data-icon="arrow_back">arrow_back</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
              location_on
            </span>
            <span className="font-headline-sm text-headline-sm font-bold text-primary dark:text-inverse-primary">
              CivicLens
            </span>
          </div>
          <button className="text-primary dark:text-primary-fixed-dim hover:bg-surface-container-low transition-colors p-2 rounded-full active:scale-95 duration-150">
            <span className="material-symbols-outlined" data-icon="location_on">location_on</span>
          </button>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-1 mt-16 px-container-margin py-lg flex flex-col gap-lg">
          
          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-error-container border border-outline-variant text-on-error-container p-3 rounded-lg flex items-start gap-2 text-xs">
              <span className="material-symbols-outlined text-sm shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Photo Upload */}
          <section className="flex flex-col gap-sm">
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileChange} 
              id="report-photo-input" 
              className="hidden" 
              disabled={isAnalyzing || isSubmitting}
            />
            <label 
              htmlFor="report-photo-input"
              className="relative w-full h-[200px] border-2 border-dashed border-outline-variant rounded-lg bg-surface-container-low flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-highest transition-colors group"
            >
              <span 
                className="material-symbols-outlined text-4xl text-primary mb-2 group-hover:scale-110 transition-transform" 
                data-icon="photo_camera" 
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                photo_camera
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">Take photo or upload</span>
              
              {/* Simulated Thumbnail Overlay */}
              {imagePreview && (
                <div className="absolute inset-0 p-2 opacity-100 transition-opacity">
                  <div className="w-full h-full rounded bg-surface relative overflow-hidden shadow-sm border border-outline-variant">
                    <img 
                      className="w-full h-full object-cover" 
                      alt="Preview" 
                      src={imagePreview}
                    />
                    <button 
                      onClick={handleClearPhoto}
                      className="absolute top-2 right-2 bg-inverse-surface text-inverse-on-surface rounded-full p-1 shadow-sm active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm" data-icon="close">close</span>
                    </button>
                  </div>
                </div>
              )}
            </label>
          </section>

          {/* Loading Skeleton during Analysis */}
          {isAnalyzing && (
            <div className="animate-pulse bg-primary-fixed/50 rounded-xl p-md border border-primary-fixed-dim h-[180px] flex flex-col justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-primary-fixed-dim rounded" />
                <div className="h-2 w-20 bg-primary-fixed-dim rounded-full" />
              </div>
              <div className="h-10 bg-primary-fixed-dim rounded w-full mt-2" />
              <div className="h-8 bg-primary-fixed-dim rounded w-5/6" />
            </div>
          )}

          {/* Section 2: AI Analysis Card (displays only if analyzed) */}
          {!isAnalyzing && analysisResult && (
            <section>
              <div className="bg-primary-fixed rounded-xl p-md border border-primary-fixed-dim shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-on-primary font-label-sm text-label-sm px-3 py-1 rounded-bl-lg flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm" data-icon="auto_awesome">auto_awesome</span> AI Detected
                </div>
                <div className="flex items-center gap-2 mb-4 mt-2">
                  <span className="bg-primary-container text-on-primary-container font-label-md text-label-md px-2 py-1 rounded capitalize">
                    {category || analysisResult.category}
                  </span>
                  <div className="flex gap-1 items-center" title={`Severity: ${severity}`}>
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span 
                        key={lvl}
                        className={`w-2 h-2 rounded-full ${lvl <= (severity || analysisResult.severity) ? 'bg-error' : 'bg-outline-variant'}`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="sr-only" htmlFor="report-title">Title</label>
                    <input 
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 font-headline-sm-mobile text-headline-sm-mobile text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-semibold" 
                      id="report-title" 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Title of Report"
                    />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="report-desc">Description</label>
                    <textarea 
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 font-body-md-mobile text-body-md-mobile text-on-surface-variant focus:ring-2 focus:ring-primary focus:border-primary transition-shadow resize-none" 
                      id="report-desc" 
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Report description details"
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between border-t border-primary-fixed-dim pt-3">
                  <div className="flex items-center gap-2 text-on-primary-fixed-variant font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-sm" data-icon="domain">domain</span>
                    {analysisResult.suggested_department || 'General Services'}
                  </div>
                  <span className="text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold">
                    {Math.round(analysisResult.confidence * 100)}% match
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Section 3: Location Coordinates */}
          <section className="flex flex-col gap-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
                </span>
                {locationStatus}
              </div>
              <button 
                type="button"
                onClick={() => {
                  setLocationStatus('Getting location...');
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      setLocationStatus('Using your current location');
                    },
                    () => setLocationStatus('Failed to reload coordinates')
                  );
                }}
                className="text-primary font-label-md text-label-md hover:underline"
              >
                Reload coords
              </button>
            </div>
            <div className="h-[120px] w-full rounded-lg border border-outline-variant overflow-hidden relative shadow-sm">
              <div 
                className="w-full h-full bg-cover bg-center" 
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCTgC_T3FwPhI3R14zdAHV52aKwus0E_3PIDUU4hZ_YgsjvoKKIXQLIPIgo8E-6DIoYhk4ou7h0pEOUMmN-2joTt0KzID3ljamA0qFe51QfRuA-xp-ESt5Mlgwx8O_BJ147rLMN_YMJK5zps5lnd06mDaaXcO5jdmV6TboGGj6GGkhBWoZZp-hUG8tMLajDSP4oMHF3VovV5h7BwX90vKo1sMFftMuosjxFBlXuVJKYxv7aUj2Su9cbf9WeEKHDRzcL7MXSXP_jLOSK')" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span 
                  className="material-symbols-outlined text-error text-3xl drop-shadow-md" 
                  data-icon="location_on" 
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  location_on
                </span>
              </div>
            </div>
          </section>

          {/* Section 4: Notes */}
          <section>
            <label className="block font-label-md text-label-md text-on-surface mb-xs" htmlFor="optional-notes">
              Optional notes
            </label>
            <textarea 
              className="w-full bg-surface-container-lowest border border-outline-variant rounded p-2 font-body-md-mobile text-body-md-mobile text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-shadow resize-none" 
              id="optional-notes" 
              placeholder="Add any details..." 
              rows={3}
              value={optionalNotes}
              onChange={(e) => setOptionalNotes(e.target.value)}
            />
          </section>
        </main>

        {/* Bottom Actions */}
        <footer className="fixed bottom-0 w-full max-w-[480px] bg-background border-t border-outline-variant shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-container-margin z-50 flex flex-col gap-2">
          <button 
            type="button"
            disabled={!imageBase64 || isAnalyzing || isSubmitting}
            onClick={() => handleSubmitReport(false)}
            className="w-full bg-primary text-on-primary rounded-lg py-3 font-label-md text-label-md shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-transform flex justify-center items-center gap-2"
          >
            {isSubmitting ? 'Submitting Report...' : 'Submit report'}
            <span className="material-symbols-outlined text-sm" data-icon="send">send</span>
          </button>
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant flex items-center justify-center gap-1">
            Your report helps your community. <span className="text-secondary font-semibold">+10 civic points</span>
          </p>
        </footer>

      </div>

      {/* Duplicate Warning Modal Overlay */}
      {duplicates && duplicates.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-background max-w-[420px] w-full rounded-2xl shadow-2xl border border-outline-variant p-6 flex flex-col gap-5">
            <div>
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
              <h3 className="text-headline-sm font-bold text-on-surface">Similar Issues Nearby</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Other citizens have already filed similar reports within 50 meters of your location:
              </p>
            </div>

            <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
              {duplicates.map((dup) => (
                <div key={dup.id} className="p-3 bg-surface-container-low border border-outline-variant rounded-xl text-left">
                  <span className="text-[10px] font-bold bg-primary-container text-on-primary-container px-2 py-0.5 rounded capitalize">
                    {dup.category}
                  </span>
                  <h4 className="font-semibold text-xs text-on-surface mt-1.5">{dup.title}</h4>
                  <span className="text-[10px] text-on-surface-variant block mt-1 uppercase font-semibold">Status: {dup.status}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant">
              <button 
                onClick={() => handleVerifyDuplicate(duplicates[0].id)}
                className="w-full bg-primary text-on-primary rounded-lg py-2.5 font-label-md hover:bg-primary-container transition-colors shadow-sm"
              >
                Add my photo to existing report (Upvote)
              </button>
              <button 
                onClick={() => handleSubmitReport(true)}
                className="w-full border border-outline text-on-surface-variant rounded-lg py-2.5 font-label-md hover:bg-surface-container-low transition-colors"
              >
                Submit as new anyway
              </button>
              <button 
                onClick={() => setDuplicates(null)}
                className="w-full text-xs text-slate-500 hover:text-slate-400 py-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
