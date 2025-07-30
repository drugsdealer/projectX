'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface SizeSelectorProps {
  type: 'clothing' | 'shoes' | 'jewelry' | 'perfume';
  sizes: {
    available: (string | number)[];
    inStock: Record<string | number, number>;
  };
  selectedSize: string | number | null;
  onSelect: (size: string | number) => void;
}

const SizeSelector: React.FC<SizeSelectorProps> = ({
  type,
  sizes,
  selectedSize,
  onSelect
}) => {
  const sizeRefs = useRef<Record<string | number, HTMLButtonElement | null>>({});
  const [sliderState, setSliderState] = useState<{ width: number; x: number }>({ width: 0, x: 0 });

  const getSizeLabel = (size: string | number) => {
    if (type === 'shoes') return `${size}`;
    if (type === 'perfume') return `${size} мл`;
    return size;
  };

  useEffect(() => {
    if (!selectedSize) return;
    const ref = sizeRefs.current[selectedSize];
    if (!ref) return;

    const rect = ref.getBoundingClientRect();
    const parentRect = ref.parentElement?.getBoundingClientRect();

    if (!parentRect) return;

    const x = rect.left - parentRect.left;
    const width = rect.width;

    setSliderState({ x, width });
  }, [selectedSize]);

  return (
    <div className="relative flex items-center bg-gray-100 p-3 rounded-full overflow-hidden">
      {/* Ползунок */}
      {selectedSize && (
        <motion.div
          className="absolute top-[26%] left-0 h-[30px] bg-black rounded-full -translate-y-1/2 z-0"
          animate={sliderState}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ position: 'absolute' }}
        />
      )}

      {/* Размеры */}
      {sizes.available.map((size) => {
        const inStock = sizes.inStock[size] > 0;
        return (
          <button
            key={size}
            ref={(el) => { sizeRefs.current[size] = el; }}
            onClick={() => inStock ? onSelect(size) : null}
            className={`relative min-h-[34px] px-6 py-2 text-sm font-semibold transition-all duration-300 z-10 ${
              selectedSize === size
                ? 'text-white'
                : inStock
                  ? 'text-black'
                  : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            {getSizeLabel(size)}
          </button>
        );
      })}
    </div>
  );
};

export default SizeSelector;