// ============================================================
// SmartLivestock AI — Responsive Viewport Hook
// ============================================================

import { useState, useEffect } from 'react';
import { Breakpoints } from '../styles/theme';

export function useResponsive() {
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 1200, height: 800 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { width, height } = dimensions;
  const isMobile = width < Breakpoints.tablet;
  const isTablet = width >= Breakpoints.tablet && width < Breakpoints.desktop;
  const isDesktop = width >= Breakpoints.desktop;
  const isWide = width >= 1280;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
  };
}

export default useResponsive;
