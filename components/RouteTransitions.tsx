'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useMotionBudget } from './MotionBudgetProvider';

interface RouteTransitionsProps {
  children: ReactNode;
}

export default function RouteTransitions({ children }: RouteTransitionsProps) {
  const pathname = usePathname();
  const { motionLevel, reduceMotion } = useMotionBudget();

  if (reduceMotion) {
    return <>{children}</>;
  }

  const isBalanced = motionLevel === 'balanced';
  const duration = isBalanced ? 0.16 : 0.22;
  const offset = isBalanced ? 4 : 8;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: offset }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
