// ============================================================
// GouNandi AI — Topbar Component with Farmer Profile Pill
// ============================================================

import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { Menu, Sun, Moon, Bell, RefreshCw, Play, Pause, User, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ConnectionStatus } from '../common/ConnectionStatus';

interface TopbarProps {
  onMenuClick: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick, onRefresh, isRefreshing = false }) => {
  const navigate = useNavigate();
  const {
    theme,
    toggleTheme,
    backendStatus,
    isPollingPaused,
    togglePollingPaused,
  } = useAppStore();

  const { farmer, farm, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initial = farmer?.full_name ? farmer.full_name.charAt(0).toUpperCase() : 'F';

  return (
    <header className="h-16 px-4 sm:px-6 bg-white dark:bg-farm-darkCard border-b border-[#E3E9E2] dark:border-farm-darkBorder flex items-center justify-between sticky top-0 z-30 transition-colors select-none">
      {/* Left: Mobile hamburger & Title with Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-[#607067] dark:text-gray-300 hover:bg-[#F7F9F4] dark:hover:bg-gray-800"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-xs border border-[#E3E9E2] dark:border-farm-darkBorder overflow-hidden shrink-0 p-0.5">
          <img src="/logo.png" alt="GouNandi Logo" className="w-full h-full object-contain" />
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#607067] dark:text-gray-400">
            <span className="text-[#2E7D32] font-bold">GouNandi</span>
            <span>/</span>
            <span className="capitalize text-[#263238] dark:text-gray-200">Livestock Intelligence</span>
          </div>
          <span className="text-sm font-extrabold text-[#263238] dark:text-white">
            {farm?.farm_name || 'GouNandi Dairy Farm'}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Connection Status Indicator */}
        <div className="hidden md:block">
          <ConnectionStatus apiStatus={backendStatus} />
        </div>

        {/* Polling Pause/Resume Toggle */}
        <button
          onClick={togglePollingPaused}
          title={isPollingPaused ? 'Resume live updates' : 'Pause live updates'}
          type="button"
          className="p-2 rounded-xl text-[#607067] dark:text-gray-300 hover:bg-[#F7F9F4] dark:hover:bg-gray-800 transition-colors"
          aria-label={isPollingPaused ? 'Resume polling' : 'Pause polling'}
        >
          {isPollingPaused ? (
            <Play className="w-4 h-4 text-[#F9A825]" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </button>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh live telemetry now"
            type="button"
            className="p-2 rounded-xl text-[#607067] dark:text-gray-300 hover:bg-[#F7F9F4] dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#2E7D32]' : ''}`} />
          </button>
        )}

        {/* Alerts Link */}
        <Link
          to="/alerts"
          className="p-2 rounded-xl text-[#607067] dark:text-gray-300 hover:bg-[#F7F9F4] dark:hover:bg-gray-800 transition-colors relative"
          aria-label="View active alerts"
        >
          <Bell className="w-4 h-4" />
        </Link>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle theme"
          aria-pressed={theme === 'dark'}
          className="p-2 rounded-xl text-[#607067] dark:text-gray-300 hover:bg-[#F7F9F4] dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#F9A825]" />
          ) : (
            <Moon className="w-4 h-4 text-[#607067]" />
          )}
        </button>

        {/* Farmer Profile Pill */}
        {farmer && (
          <div className="flex items-center gap-1 pl-1 border-l border-[#E3E9E2] dark:border-farm-darkBorder">
            <Link
              to="/profile"
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-[#E3E9E2] dark:border-farm-darkBorder bg-[#F7F9F4] dark:bg-gray-800/60 hover:bg-[#E8F5E9] hover:border-[#C8E6C9] transition-all"
              title="View & Edit Farmer Profile"
            >
              <div className="w-6 h-6 rounded-lg bg-[#2E7D32] text-white flex items-center justify-center text-xs font-extrabold shrink-0">
                {initial}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <p className="font-bold text-[#263238] dark:text-white leading-tight">
                  {farmer.full_name}
                </p>
                <p className="text-[10px] text-[#2E7D32] font-semibold leading-none">
                  {farmer.farmer_id}
                </p>
              </div>
            </Link>

            <button
              onClick={handleLogout}
              type="button"
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 rounded-xl text-[#607067] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
