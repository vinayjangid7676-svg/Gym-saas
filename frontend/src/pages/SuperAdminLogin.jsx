import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api';

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier || !password) {
      return setError('Admin email/phone aur password required hain.');
    }

    setLoading(true);
    const res = await apiPost('/api/v1/super-admin/login', { identifier, password });
    setLoading(false);

    if (res?.success && res?.token) {
      // Store dedicated admin token & user context
      localStorage.setItem('gym_access_token', res.token);
      localStorage.setItem('gym_user', JSON.stringify(res.admin));
      localStorage.removeItem('gym_active_branch_id'); // Superadmin has global view
      navigate('/admin/dashboard');
    } else {
      setError(res?.message || 'Access Denied: Invalid Master Credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 selection:bg-red-500 selection:text-white">
      <div className="w-full max-w-md bg-zinc-950 border border-red-950/60 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {/* Glow Element */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-red-500/10 text-red-500 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto text-xl font-black mb-3">
            ⚡
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Root Master Access</h2>
          <p className="text-xs text-zinc-500 mt-1">Platform Multi-Tenant Headquarters</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Master Admin Identifier
            </label>
            <input
              type="text"
              required
              placeholder="admin@gymsaas.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              Secret Passkey
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-500 transition disabled:opacity-50 shadow-lg shadow-red-600/20"
          >
            {loading ? 'Authenticating System...' : 'Authorize Deck →'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-zinc-900 pt-4">
          <a href="/login" className="text-xs text-zinc-600 hover:text-zinc-400 transition">
            ← Tenant Gym Login
          </a>
        </div>
      </div>
    </div>
  );
}