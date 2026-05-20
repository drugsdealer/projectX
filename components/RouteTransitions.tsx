'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

interface RouteTransitionsProps {
  children: ReactNode;
}

// Thin top-bar progress indicator — shows on every navigation without causing blank screens.
// Replaces AnimatePresence mode="wait" which created a blank gap between exit and entry animations.
function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    setProgress(0);
    setVisible(true);

    let current = 0;
    const step = () => {
      current = current + (85 - current) * 0.12;
      setProgress(current);
      if (current < 84) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    timerRef.current = setTimeout(() => {
      setProgress(100);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[2px] bg-black pointer-events-none"
      style={{
        width: `${progress}%`,
        transition: progress === 100 ? 'width 0.2s ease-out' : 'width 0.08s linear',
      }}
    />
  );
}

export default function RouteTransitions({ children }: RouteTransitionsProps) {
  return (
    <>
      <NavigationProgress />
      {children}
    </>
  );
}
