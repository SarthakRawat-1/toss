import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, LogOut, HardDrive, Settings, FolderOpen } from 'lucide-react';
import type { AuthStatus } from '../lib/services/auth.service';

interface NavbarProps {
  authStatus: AuthStatus | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ authStatus, onLogout }) => {
  const location = useLocation();

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`text-sm transition-colors ${
          active ? 'text-white font-medium' : 'text-[#555] hover:text-[#aaa]'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="border-b border-[#1f1f1f] bg-[#0a0a0a] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white hover:text-[#aaa] transition-colors">
          <FolderOpen className="w-5 h-5 text-[#22c55e]" strokeWidth={2} />
          <span className="font-semibold text-base tracking-tight">Toss</span>
        </Link>

        <nav className="flex items-center gap-8">
          {navLink('/', 'Files')}

          {(!authStatus?.authEnabled || authStatus?.loggedIn) && (
            <>
              {navLink('/dashboard', 'Dashboard')}
              {navLink('/config', 'Config')}
            </>
          )}

          {authStatus?.authEnabled && (
            authStatus.loggedIn ? (
              <button
                onClick={onLogout}
                className="text-sm text-[#555] hover:text-red-400 transition-colors cursor-pointer"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                className="text-sm text-[#22c55e] hover:text-[#16a34a] transition-colors"
              >
                Sign in
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
};
