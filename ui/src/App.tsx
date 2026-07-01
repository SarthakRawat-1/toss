import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { DownloadPage } from './pages/DownloadPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ConfigPage } from './pages/ConfigPage';
import { AuthService } from './lib/services/auth.service';
import type { AuthStatus } from './lib/services/auth.service';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAuthStatus = async () => {
    try {
      const status = await AuthService.getStatus();
      setAuthStatus(status);
    } catch (err) {
      console.error('Failed to get auth status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      await fetchAuthStatus();
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  // Protected route wrapper component
  const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    if (loading) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-brand-accent animate-spin" />
        </div>
      );
    }

    if (authStatus?.authEnabled && !authStatus.loggedIn) {
      return <Navigate to="/login" replace />;
    }

    return children;
  };

  if (loading && !authStatus) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col text-white">
        <Navbar authStatus={authStatus} onLogout={handleLogout} />
        
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<DownloadPage />} />
            <Route path="/download" element={<DownloadPage />} />
            
            <Route 
              path="/login" 
              element={
                authStatus?.loggedIn ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LoginPage onLoginSuccess={fetchAuthStatus} />
                )
              } 
            />

            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/config" 
              element={
                <ProtectedRoute>
                  <ConfigPage />
                </ProtectedRoute>
              } 
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="py-4 border-t border-[#1a1a1a] text-center text-xs text-[#2a2a2a]">
          Toss &copy; {new Date().getFullYear()} - Local network file sharing
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
