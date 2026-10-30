// ============================================================
// SmartLivestock AI — MobileDrawer Component
// ============================================================

import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Overlay Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative w-64 max-w-[80vw] h-full bg-white dark:bg-farm-darkCard shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-3 p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
        <Sidebar onNavClick={onClose} />
      </div>
    </div>
  );
};

