export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 gap-4 font-sans">
      <div className="w-12 h-12 rounded-full border-4 border-t-primary border-slate-800 animate-spin" />
      <div className="text-center">
        <h3 className="text-md font-bold text-slate-300">Loading Map...</h3>
        <p className="text-xs text-slate-500 mt-1 animate-pulse">Initializing spatial coordinates and pins</p>
      </div>
    </div>
  );
}
