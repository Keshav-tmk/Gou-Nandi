// ============================================================
// GouNandi AI — Farmer Login Page (/login)
// ============================================================

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { Card } from '../components/common/Card';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authService.login(email, password);
      if (res && res.access_token) {
        setAuth(res.access_token, res.farmer);
        navigate(from, { replace: true });
      } else {
        setErrorMessage('Authentication succeeded but token was missing.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password@123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F9F4] dark:bg-farm-darkBg flex flex-col justify-center items-center p-4 sm:p-6 transition-colors select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-[#E3E9E2] dark:border-farm-darkBorder p-2 mb-1">
            <img src="/logo.png" alt="GouNandi Emblem" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#263238] dark:text-white tracking-tight flex items-center justify-center gap-1.5">
            GouNandi <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#E8F5E9] text-[#2E7D32] uppercase tracking-wider">AI</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#607067] dark:text-gray-400">
            Secure Multi-Farmer Cattle Health & Telemetry Portal
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 sm:p-8 bg-white dark:bg-farm-darkCard border border-[#E3E9E2] dark:border-farm-darkBorder shadow-lg rounded-2xl">
          <div className="mb-5 pb-3 border-b border-[#E3E9E2] dark:border-farm-darkBorder flex items-center justify-between">
            <h2 className="text-base font-bold text-[#263238] dark:text-white">
              Sign In to Farm Dashboard
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              Isolated Data
            </span>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2.5 text-xs text-[#D84343]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#607067] dark:text-gray-300 mb-1">
                Farmer Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8A9990] absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="farmer@dairyfarm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white placeholder-[#8A9990] focus:outline-hidden focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#607067] dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8A9990] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E3E9E2] dark:border-gray-700 bg-[#F7F9F4] dark:bg-gray-800 text-[#263238] dark:text-white placeholder-[#8A9990] focus:outline-hidden focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Pills */}
          <div className="mt-6 pt-5 border-t border-[#E3E9E2] dark:border-farm-darkBorder">
            <p className="text-[11px] font-semibold text-[#607067] dark:text-gray-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#2E7D32]" />
              Quick Demo Accounts (Evaluation Test Cases):
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickLogin('farmer_a@test.com')}
                className="p-2 rounded-xl bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#C8E6C9] text-[#2E7D32] font-semibold text-left transition-all cursor-pointer"
              >
                <div className="font-bold flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Farmer A
                </div>
                <div className="text-[10px] text-[#607067]">Green Valley Dairy</div>
                <div className="text-[9px] text-[#2E7D32]/80 mt-0.5">COW-001 to 003</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('farmer_b@test.com')}
                className="p-2 rounded-xl bg-[#FFF8E1] hover:bg-[#FFE082] border border-[#FFE082] text-[#B7791F] font-semibold text-left transition-all cursor-pointer"
              >
                <div className="font-bold flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Farmer B
                </div>
                <div className="text-[10px] text-[#607067]">Sunrise Dairy</div>
                <div className="text-[9px] text-[#B7791F]/80 mt-0.5">COW-004 to 006</div>
              </button>
            </div>
          </div>
        </Card>

        {/* Footer Link to Register */}
        <div className="text-center text-xs text-[#607067] dark:text-gray-400">
          New dairy farmer?{' '}
          <Link
            to="/register"
            className="font-bold text-[#2E7D32] hover:underline"
          >
            Register Your Farm Account
          </Link>
        </div>
      </div>
    </div>
  );
};

