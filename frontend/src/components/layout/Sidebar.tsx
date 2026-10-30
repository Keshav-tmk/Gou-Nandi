// ============================================================
// SmartLivestock AI — Application Sidebar
// ============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  ListFilter,
  Bell,
  BarChart3,
  Settings,
  Info,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface SidebarProps {
  onNavClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavClick }) => {
  const { isDemoMode } = useAppStore();

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/behaviour', label: 'Collar Telemetry', icon: Activity },
    { to: '/cows', label: 'Cows', icon: ListFilter },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/about', label: 'About', icon: Info },
  ];

  return (
    <aside className="w-64 h-full bg-white dark:bg-farm-darkCard border-r border-farm-border dark:border-farm-darkBorder flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-farm-border dark:border-farm-darkBorder flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-700 flex items-center justify-center text-white text-xl shadow-sm">
            🐄
          </div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              SmartLivestock
            </h1>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Dairy Farm
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 m-4 rounded-xl bg-gray-50 dark:bg-farm-darkBorder/40 border border-farm-border dark:border-farm-darkBorder text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Phase 2 AI Engine</span>
          {isDemoMode ? (
            <span className="text-amber-600 font-bold">Demo</span>
          ) : (
            <span className="text-emerald-600 font-bold">Live</span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 leading-tight">
          ESP32 Collar Telemetry • 5-Module Scikit-Learn Pipeline
        </p>
      </div>
    </aside>
  );
};

