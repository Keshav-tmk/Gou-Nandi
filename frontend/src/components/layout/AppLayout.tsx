// ============================================================
// SmartLivestock AI — Application Shell Layout
// ============================================================

import React from 'react';
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

  return (
    <div className="flex h-screen bg-farm-bg dark:bg-farm-darkBg overflow-hidden transition-colors">
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Demo Mode Notice Banner */}
        <DemoBanner />

        {/* Top Navbar */}
        <Topbar onMenuClick={() => setMobileDrawerOpen(true)} />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

