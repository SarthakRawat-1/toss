import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../lib/services/auth.service';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await AuthService.login(username, password);
      onLoginSuccess();
      navigate('/dashboard');
    } catch (err: any) {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-49px)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white">Sign in</h1>
          <p className="text-sm text-[#555] mt-1">Access the Toss admin panel.</p>
        </div>

        {error && (
          <div className="mb-5 text-sm text-red-400 border border-red-900/40 bg-red-950/20 px-3 py-2.5 rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-[#555] block">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2.5 text-sm text-white placeholder-[#333] transition-colors"
              placeholder="admin"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#555] block">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2.5 text-sm text-white placeholder-[#333] transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-40 text-black font-semibold text-sm py-2.5 rounded-sm transition-colors cursor-pointer mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
