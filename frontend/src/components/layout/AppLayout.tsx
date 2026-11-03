// ============================================================
// SmartLivestock AI — Application Shell Layout
// ============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  ListFilter,
  Bell,
  Settings,
  BarChart3,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileDrawer } from './MobileDrawer';
import { DemoBanner } from './DemoBanner';
import { useAppStore } from '../../store/appStore';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { isMobileDrawerOpen, setMobileDrawerOpen } = useAppStore();

  const mobileNavItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/cows', label: 'Herd', icon: ListFilter },
    { to: '/behaviour', label: 'Behaviour', icon: Activity },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-[#F7F9F4] dark:bg-farm-darkBg overflow-hidden transition-colors">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Demo Mode Notice Banner */}
        <DemoBanner />

        {/* Top Navbar */}
        <Topbar onMenuClick={() => setMobileDrawerOpen(true)} />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 pb-20 lg:pb-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-farm-darkCard/95 backdrop-blur-md border-t border-[#E3E9E2] dark:border-farm-darkBorder flex items-center justify-around py-2 px-1 z-20 shadow-lg"
        >
          {mobileNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all ${
                  isActive
                    ? 'text-[#2E7D32] dark:text-emerald-400'
                    : 'text-[#607067] dark:text-gray-400 hover:text-[#263238]'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};

