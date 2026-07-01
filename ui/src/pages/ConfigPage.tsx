import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ConfigService } from '../lib/services/config.service';
import type { ConfigDto } from '../lib/services/config.service';

export const ConfigPage: React.FC = () => {
  const [config, setConfig] = useState<ConfigDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [port, setPort] = useState(8080);
  const [basePath, setBasePath] = useState('');
  const [maxSize, setMaxSize] = useState(0);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [loggingLevel, setLoggingLevel] = useState('info');

  useEffect(() => {
    (async () => {
      try {
        const data = await ConfigService.getConfig();
        setConfig(data);
        setPort(data.server.port);
        setBasePath(data.storage.base_path);
        setMaxSize(data.storage.max_size);
        setAuthEnabled(data.auth.authentication);
        setLoggingEnabled(data.logging.logging);
        setLoggingLevel(data.logging.logging_level);
      } catch (err: any) {
        setError(err?.message || 'Failed to load configuration.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      await ConfigService.updateConfig({
        server: { port },
        tls: config.tls,
        storage: { base_path: basePath, max_size: maxSize },
        auth: { authentication: authEnabled },
        logging: { logging: loggingEnabled, logging_level: loggingLevel },
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#333]">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-base font-semibold text-white">Configuration</h1>
        <p className="text-xs text-[#444] mt-1">Changes take effect after restarting the server.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-[#22c55e] border border-[#22c55e]/20 bg-[#22c55e]/5 px-3 py-2.5 rounded-sm mb-6">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Saved. Restart the server for changes to apply.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 border border-red-900/30 bg-red-950/15 px-3 py-2.5 rounded-sm mb-6">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Server */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#444] uppercase tracking-wider pb-3 border-b border-[#1a1a1a]">Server</h2>
          <div className="space-y-1 max-w-xs">
            <label className="text-xs text-[#555]">Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={e => setPort(parseInt(e.target.value) || 8080)}
              className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2 text-sm text-white font-mono"
              required
            />
          </div>
        </section>

        {/* Storage */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#444] uppercase tracking-wider pb-3 border-b border-[#1a1a1a]">Storage</h2>
          <div className="space-y-1">
            <label className="text-xs text-[#555]">Base directory path</label>
            <input
              type="text"
              value={basePath}
              onChange={e => setBasePath(e.target.value)}
              className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2 text-sm text-white font-mono"
              required
            />
          </div>
          <div className="space-y-1 max-w-xs">
            <label className="text-xs text-[#555]">Max file size (MB)</label>
            <input
              type="number"
              min={1}
              value={Math.round(maxSize / (1024 * 1024))}
              onChange={e => setMaxSize((parseInt(e.target.value) || 0) * 1024 * 1024)}
              className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2 text-sm text-white font-mono"
              required
            />
          </div>
        </section>

        {/* Security */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#444] uppercase tracking-wider pb-3 border-b border-[#1a1a1a]">Security</h2>
          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="text-sm text-[#aaa] group-hover:text-white transition-colors">Require authentication</p>
              <p className="text-xs text-[#444] mt-0.5">Protect dashboard and upload with admin login.</p>
            </div>
            <div
              onClick={() => setAuthEnabled(v => !v)}
              className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${authEnabled ? 'bg-[#22c55e]' : 'bg-[#1f1f1f]'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${authEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </section>

        {/* Logging */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#444] uppercase tracking-wider pb-3 border-b border-[#1a1a1a]">Logging</h2>
          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <p className="text-sm text-[#aaa] group-hover:text-white transition-colors">Enable file logging</p>
              <p className="text-xs text-[#444] mt-0.5">Write audit logs to disk.</p>
            </div>
            <div
              onClick={() => setLoggingEnabled(v => !v)}
              className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${loggingEnabled ? 'bg-[#22c55e]' : 'bg-[#1f1f1f]'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${loggingEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>
          {loggingEnabled && (
            <div className="space-y-1 max-w-xs">
              <label className="text-xs text-[#555]">Log level</label>
              <select
                value={loggingLevel}
                onChange={e => setLoggingLevel(e.target.value)}
                className="w-full bg-[#111] border border-[#1f1f1f] rounded-sm px-3 py-2 text-sm text-white"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>
          )}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-40 text-black font-semibold text-sm px-6 py-2.5 rounded-sm transition-colors cursor-pointer flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
};
