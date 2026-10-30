// ============================================================
// SmartLivestock AI — Topbar Component
// ============================================================

import React from 'react';
import { useAppStore } from '../../store/appStore';
import { Menu, Sun, Moon, Bell, RefreshCw, Play, Pause } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConnectionStatus } from '../common/ConnectionStatus';

interface TopbarProps {
  onMenuClick: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick, onRefresh, isRefreshing = false }) => {
  const {
    theme,
    toggleTheme,
    backendStatus,
    isPollingPaused,
    togglePollingPaused,
  } = useAppStore();

  return (
    <header className="h-16 px-4 sm:px-6 bg-white dark:bg-farm-darkCard border-b border-farm-border dark:border-farm-darkBorder flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left: Mobile hamburger & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
            Dairy Herd Health Intelligence
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            SmartLivestock Dairy Farm
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
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={isPollingPaused ? 'Resume polling' : 'Pause polling'}
        >
          {isPollingPaused ? (
            <Play className="w-4 h-4 text-amber-500" />
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
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Alerts Link */}
        <Link
          to="/alerts"
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
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
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
    </header>
  );
};

