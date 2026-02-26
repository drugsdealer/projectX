'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

type SizeValue = string | number;

interface SizeSelectorProps {
  type: 'clothing' | 'shoes' | 'jewelry' | 'perfume';
  sizes: {
    available: SizeValue[];
    /**
     * Ключи могут быть как "42", так и 42 — внутри мы всё нормализуем к строке.
     */
    inStock?: Record<string | number, number>;
  };
  selectedSize: SizeValue | null;
  onSelect: (size: SizeValue) => void;
}

const SizeSelector: React.FC<SizeSelectorProps> = ({
  type,
  sizes,
  selectedSize,
  onSelect
}) => {
  const sizeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const toKey = (value: SizeValue) => String(value);
  const [sliderState, setSliderState] = useState<{ width: number; x: number }>({ width: 0, x: 0 });

  const getSizeLabel = (size: SizeValue) => {
    if (type === 'shoes') return `${size}`;
    if (type === 'perfume') return `${size} мл`;
    return size;
  };

  useEffect(() => {
    if (selectedSize === null || selectedSize === undefined) return;
    const key = toKey(selectedSize);
    const ref = sizeRefs.current[key];
    if (!ref) return;

    const rect = ref.getBoundingClientRect();
    const parentRect = ref.parentElement?.getBoundingClientRect();

    if (!parentRect) return;

    const x = rect.left - parentRect.left;
    const width = rect.width;

    setSliderState({ x, width });
  }, [selectedSize, sizes.available]);

  const normalizedAvailable = useMemo(
    () =>
      Array.isArray(sizes?.available)
        ? sizes.available.filter(
            (v): v is SizeValue =>
              v !== null && v !== undefined && String(v).trim().length > 0
          )
        : [],
    [sizes?.available]
  );

  if (!sizes || normalizedAvailable.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="relative inline-flex items-center bg-gray-100 px-2.5 sm:px-3 py-2 rounded-full overflow-hidden">
        {/* Ползунок */}
        {selectedSize !== null && selectedSize !== undefined && (
          <motion.div
            className="absolute top-[18%] left-0 h-[30px] bg-black rounded-full -translate-y-1/2 z-0"
            animate={sliderState}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ position: 'absolute' }}
          />
        )}

        {/* Размеры */}
        {normalizedAvailable.map((size) => {
          const stockMap = sizes.inStock ?? {};
          const inStockCount =
            (stockMap as Record<string, number>)[toKey(size)] ?? 1;
          const inStock = inStockCount > 0;
          return (
            <button
              key={size}
              ref={(el) => {
                sizeRefs.current[toKey(size)] = el;
              }}
              onClick={() => (inStock ? onSelect(size) : null)}
              className={`relative min-h-[30px] px-3 sm:px-4 py-1 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 z-10 ${
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
    </div>
  );
};

export default SizeSelector;