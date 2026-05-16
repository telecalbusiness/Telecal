import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Sun, Moon } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  const { isDark, toggle } = useDarkMode();

  return (
    <div className="auth-bg min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-brand group-hover:shadow-lg transition-shadow">
            <Stethoscope size={16} className="text-white" />
          </div>
          <span className="font-display font-semibold text-[var(--text-primary)] tracking-tight">
            Telecal
          </span>
        </Link>
        <button
          onClick={toggle}
          className="btn btn-ghost p-2 rounded-xl"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Auth card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px] animate-slide-up">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-[var(--text-muted)]">
        &copy; {new Date().getFullYear()} Telecal. All rights reserved.
        {' · '}
        <Link to="/privacy" className="hover:text-brand-600 transition-colors">Privacy</Link>
        {' · '}
        <Link to="/terms" className="hover:text-brand-600 transition-colors">Terms</Link>
      </footer>
    </div>
  );
};
