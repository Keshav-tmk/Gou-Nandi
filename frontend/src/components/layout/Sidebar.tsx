// ============================================================
// GouNandi AI — Sidebar Component with Multi-Farmer Navigation
// ============================================================

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  ListFilter,
  Bell,
  Settings,
  Info,
  BarChart3,
  User,
  LogOut,
  Building,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
  onNavClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavClick }) => {
  const navigate = useNavigate();
  const { isDemoMode } = useAppStore();
  const { farmer, farm, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const mainNavLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/cows', label: 'Herd Monitoring', icon: ListFilter },
    { to: '/behaviour', label: 'Behaviour Intelligence', icon: Activity },
  ];

  const insightsNavLinks = [
    { to: '/alerts', label: 'Health Alerts', icon: Bell },
    { to: '/analytics', label: 'Analytics & Insights', icon: BarChart3 },
  ];

  const systemNavLinks = [
    { to: '/profile', label: 'Farm Profile', icon: User },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/about', label: 'About GouNandi', icon: Info },
  ];

  return (
    <aside className="w-64 h-full bg-white dark:bg-farm-darkCard border-r border-[#E3E9E2] dark:border-farm-darkBorder flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-[#E3E9E2] dark:border-farm-darkBorder flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-xs border border-[#E3E9E2] dark:border-farm-darkBorder overflow-hidden shrink-0 p-1">
            <img src="/logo.png" alt="GouNandi Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#263238] dark:text-white tracking-tight flex items-center gap-1.5">
              GouNandi <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#E8F5E9] text-[#2E7D32] uppercase tracking-wider">AI</span>
            </h1>
            <p className="text-xs font-semibold text-[#66BB6A] truncate max-w-[140px]">
              {farm?.farm_name || 'Livestock Intelligence'}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-4">
          <div>
            <p className="px-3 pb-1.5 text-[10px] font-bold text-[#607067] uppercase tracking-wider">
              Monitoring
            </p>
            <div className="space-y-1">
              {mainNavLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#E8F5E9] text-[#2E7D32] shadow-xs border border-[#C8E6C9]'
                        : 'text-[#607067] hover:bg-[#F7F9F4] hover:text-[#263238] dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div>
            <p className="px-3 pb-1.5 text-[10px] font-bold text-[#607067] uppercase tracking-wider">
              Vigilance & Analytics
            </p>
            <div className="space-y-1">
              {insightsNavLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#E8F5E9] text-[#2E7D32] shadow-xs border border-[#C8E6C9]'
                        : 'text-[#607067] hover:bg-[#F7F9F4] hover:text-[#263238] dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div>
            <p className="px-3 pb-1.5 text-[10px] font-bold text-[#607067] uppercase tracking-wider">
              System
            </p>
            <div className="space-y-1">
              {systemNavLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#E8F5E9] text-[#2E7D32] shadow-xs border border-[#C8E6C9]'
                        : 'text-[#607067] hover:bg-[#F7F9F4] hover:text-[#263238] dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* Footer Info & Farmer Profile */}
      <div className="p-3 m-3 space-y-2 select-none">
        {farmer && (
          <div className="p-3 rounded-2xl bg-[#E8F5E9]/60 dark:bg-emerald-950/40 border border-[#C8E6C9] dark:border-emerald-800/50 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-bold text-[#263238] dark:text-white truncate">
                {farmer.full_name}
              </p>
              <p className="text-[10px] font-semibold text-[#2E7D32] dark:text-emerald-400 truncate">
                {farmer.farmer_id}
              </p>
            </div>
            <button
              onClick={handleLogout}
              type="button"
              title="Sign Out"
              className="p-1.5 rounded-xl text-[#607067] hover:text-red-600 hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="p-3 rounded-2xl bg-[#F7F9F4] dark:bg-farm-darkBorder/40 border border-[#E3E9E2] dark:border-farm-darkBorder text-xs text-[#607067] dark:text-gray-400">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-[#263238] dark:text-gray-300">GouNandi AI Engine</span>
            {isDemoMode ? (
              <span className="text-[#B7791F] font-extrabold text-[10px] px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#FFE082]">Demo</span>
            ) : (
              <span className="text-[#2E7D32] font-extrabold text-[10px] px-2 py-0.5 rounded-full bg-[#E8F5E9] border border-[#C8E6C9]">Live</span>
            )}
          </div>
          <p className="text-[10px] text-[#607067] dark:text-gray-400 leading-tight">
            ESP32 Telemetry • 5-Module Pipeline
          </p>
        </div>
      </div>
    </aside>
  );
};
