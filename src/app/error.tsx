'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 gap-6 font-sans text-center">
      {/* Load Material Symbols Outlined Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl font-bold">warning</span>
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-200">Something went wrong!</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          {error.message || 'An unexpected error occurred while communicating with the civic systems.'}
        </p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg py-2.5 px-6 transition-all duration-100 shadow-sm active:scale-95 text-sm"
        >
          Try again
        </button>
        <a
          href="/"
          className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700/65 text-slate-100 font-semibold rounded-lg py-2.5 px-6 transition-all duration-100 active:scale-95 text-sm"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}
