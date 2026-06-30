import Link from 'next/link';

export default function Home() {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col relative overflow-x-hidden">
        {/* Background Grid */}
        <div 
          className="absolute inset-0 pointer-events-none -z-10" 
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(113, 120, 129, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(113, 120, 129, 0.05) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background pointer-events-none -z-10" />
        
        {/* Main Content Canvas */}
        <main className="flex-grow flex flex-col justify-center items-center px-gutter py-xl relative">
          {/* Hero Section */}
          <div className="w-full max-w-md mx-auto text-center flex flex-col items-center gap-md">
            {/* Logo Mark */}
            <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-xs shadow-sm">
              <span 
                className="material-symbols-outlined"
                style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
              >
                location_on
              </span>
            </div>
            {/* Headlines */}
            <div className="flex flex-col gap-sm">
              <span className="text-xl font-black tracking-widest text-primary/80 uppercase">CivicLens</span>
              <h1 className="font-display-lg-mobile text-display-lg-mobile text-primary">
                Report. Track. Resolve.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[300px] mx-auto">
                AI-powered civic issue reporting for your community
              </p>
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-sm w-full mt-sm">
              <Link
                href="/report"
                className="w-full bg-primary-container text-on-primary-container font-label-md text-label-md py-sm px-gutter rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-xs shadow-sm animate-button-hover"
              >
                <span 
                  className="material-symbols-outlined" 
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  add_circle
                </span>
                Report an issue
              </Link>
              <Link
                href="/map"
                className="w-full border border-primary-container text-primary-container font-label-md text-label-md py-sm px-gutter rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-colors flex items-center justify-center gap-xs"
              >
                <span className="material-symbols-outlined">map</span>
                View live map
              </Link>
              <Link
                href="/dashboard"
                className="w-full border border-outline-variant text-on-surface-variant font-label-md text-label-md py-sm px-gutter rounded-lg hover:bg-surface-variant transition-colors flex items-center justify-center gap-xs"
              >
                <span className="material-symbols-outlined">dashboard</span>
                Dashboard
              </Link>
            </div>
          </div>

          {/* Stat Strip */}
          <div className="w-full max-w-md mx-auto mt-xl flex flex-col gap-md">
            <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-5 md:p-6 flex items-center justify-between shadow-sm">
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-primary-container">500+</span>
                <span className="font-label-md text-label-md text-on-surface-variant">issues resolved</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container-low text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">task_alt</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-5 md:p-6 flex items-center justify-between shadow-sm">
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-primary-container">12</span>
                <span className="font-label-md text-label-md text-on-surface-variant">wards covered</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container-low text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">my_location</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-surface-variant rounded-lg p-5 md:p-6 flex items-center justify-between shadow-sm">
              <div className="flex flex-col">
                <span className="font-headline-md text-headline-md text-primary-container">AI</span>
                <span className="font-label-md text-label-md text-on-surface-variant">verified in seconds</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container-low text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">bolt</span>
              </div>
            </div>
          </div>
        </main>

        {/* Footer Component */}
        <footer className="bg-surface-container-highest dark:bg-inverse-surface border-t border-outline-variant dark:border-outline flat no shadows flex flex-col md:flex-row justify-between items-center gap-base px-gutter py-md w-full full-width bottom-0 z-10 relative">
          <div className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim">
            CivicLens
          </div>
          <p className="font-label-sm text-label-sm text-on-surface-variant dark:text-surface-variant text-center md:text-left">
            © 2024 CivicLens. Empowering communities through transparency.
          </p>
          <nav className="flex flex-wrap justify-center gap-sm mt-sm md:mt-0">
            <a 
              className="font-label-sm text-label-sm text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors"
              href="#"
            >
              Terms of Service
            </a>
            <a 
              className="font-label-sm text-label-sm text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors"
              href="#"
            >
              Privacy Policy
            </a>
            <a 
              className="font-label-sm text-label-sm text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors"
              href="#"
            >
              Contact Support
            </a>
            <a 
              className="font-label-sm text-label-sm text-on-surface-variant dark:text-surface-variant hover:text-secondary dark:hover:text-secondary-fixed transition-colors"
              href="#"
            >
              Accessibility
            </a>
          </nav>
        </footer>
      </div>
    </>
  );
}
