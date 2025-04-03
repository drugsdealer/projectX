'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface PremiumAnimationProps {
  isVisible: boolean;
}

export const PremiumAnimation: React.FC<PremiumAnimationProps> = ({ isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="fixed inset-0 bg-black flex items-center justify-center z-[9999]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.5 }}
            className="relative text-white text-5xl font-bold"
          >
            Premium
            <img
              src="/img/звездочкиии.png"
              alt="Star"
              className="absolute -top-12 -left-12 w-16 h-16 animate-spin-slow"
            />
            <img
              src="/img/звездочкиии.png"
              alt="Star"
              className="absolute -bottom-12 -right-12 w-16 h-16 animate-spin-slow"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
