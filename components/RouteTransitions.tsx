'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

interface RouteTransitionsProps {
  children: ReactNode;
}

export default function RouteTransitions({ children }: RouteTransitionsProps) {
  return <>{children}</>;
}
