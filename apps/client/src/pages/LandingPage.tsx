import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope, Shield, Video, Clock, ChevronDown,
  Sun, Moon, UserCircle, UserCog, ShieldCheck,
} from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';

export const LandingPage: React.FC = () => {
  const { isDark, toggle } = useDarkMode();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--surface-1)]">

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="border-b border-[var(--border)] bg-[var(--surface-0)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-brand">
              <Stethoscope size={16} className="text-white" />
            </div>
            <span className="font-display font-semibold text-[var(--text-primary)] tracking-tight text-lg">
              Telecal
            </span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="btn btn-ghost p-2 rounded-xl"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Login dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="btn btn-primary flex items-center gap-2"
              >
                Sign in
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 card shadow-2xl animate-scale-in z-50">
                  <div className="p-2 space-y-0.5">
                    <p className="text-xs font-medium text-[var(--text-muted)] px-3 py-1.5 uppercase tracking-wide">
                      Sign in as
                    </p>

                    <Link
                      to="/auth/login?role=patient"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                        <UserCircle size={16} className="text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Patient</p>
                        <p className="text-xs text-[var(--text-muted)]">Book a consultation</p>
                      </div>
                    </Link>

                    <Link
                      to="/auth/login?role=doctor"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <UserCog size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Doctor</p>
                        <p className="text-xs text-[var(--text-muted)]">Access your dashboard</p>
                      </div>
                    </Link>

                    <div className="h-px bg-[var(--border)] my-1" />

                    <Link
                      to="/auth/login?role=admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck size={16} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Admin</p>
                        <p className="text-xs text-[var(--text-muted)]">Platform management</p>
                      </div>
                    </Link>
                  </div>

                  <div className="border-t border-[var(--border)] p-2">
                    <Link
                      to="/auth/register/patient"
                      onClick={() => setDropdownOpen(false)}
                      className="block w-full text-center px-3 py-2 rounded-lg text-sm text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-medium transition-colors"
                    >
                      New patient? Register here
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 text-sm font-medium px-4 py-1.5 rounded-full border border-brand-200 dark:border-brand-800 mb-8">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-brand" />
          Doctors available now
        </div>

        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight mb-6 text-balance">
          Healthcare at your
          <span className="text-brand-600 dark:text-brand-400"> fingertips</span>
        </h1>

        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Connect with verified doctors instantly. Consult a general practitioner or
          specialist, get prescriptions, and have your lab reports reviewed — all from
          the comfort of your home.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/auth/register/patient"
            className="btn btn-primary text-base px-8 py-3 rounded-xl w-full sm:w-auto"
          >
            Get started as a patient
          </Link>
          <Link
            to="/auth/register/doctor"
            className="btn btn-secondary text-base px-8 py-3 rounded-xl w-full sm:w-auto"
          >
            Join as a doctor
          </Link>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <Video size={22} />,
              title: 'HD video consultations',
              description: 'Secure in-app video calls — no Zoom or WhatsApp needed',
              color: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
            },
            {
              icon: <Shield size={22} />,
              title: 'Verified doctors only',
              description: 'Every doctor is credential-checked before joining the platform',
              color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
            },
            {
              icon: <Clock size={22} />,
              title: 'Available right now',
              description: 'See which doctors are online and get assigned in minutes',
              color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
            },
            {
              icon: <Stethoscope size={22} />,
              title: 'GP and specialists',
              description: 'Dentists, cardiologists, neurologists and more — all in one place',
              color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
            },
          ].map((feature) => (
            <div key={feature.title} className="card p-5 space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${feature.color}`}>
                {feature.icon}
              </div>
              <div>
                <p className="font-display font-semibold text-[var(--text-primary)] text-sm">
                  {feature.title}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface-0)]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center">
              <Stethoscope size={12} className="text-white" />
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">Telecal</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} Telecal. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-[var(--text-muted)]">
            <a href="#" className="hover:text-brand-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-brand-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-brand-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
};