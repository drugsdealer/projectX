'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpDown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface Props {
  className?: string;
}

type SortKey = 'popular' | 'price-asc' | 'price-desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Популярное' },
  { key: 'price-asc', label: 'Сначала дешевое' },
  { key: 'price-desc', label: 'Сначала дорогое' },
];

const STORAGE_KEY = 'sort:key';

export const SortPopup: React.FC<Props> = ({ className }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // derive initial from URL → localStorage → default
  const initialKey: SortKey = ((): SortKey => {
    const q = (searchParams?.get('sort') || '').toLowerCase();
    if (q === 'price-asc' || q === 'price-desc' || q === 'popular') return q as SortKey;
    if (typeof window !== 'undefined') {
      const s = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      if (s === 'price-asc' || s === 'price-desc' || s === 'popular') return s as SortKey;
    }
    return 'popular';
  })();

  const [currentKey, setCurrentKey] = useState<SortKey>(initialKey);

  // keep index in sync with key
  const currentIndex = useMemo(() => {
    const i = SORT_OPTIONS.findIndex(o => o.key === currentKey);
    return i >= 0 ? i : 0;
  }, [currentKey]);

  // write to URL + storage + dispatch global event
  const commitSort = (key: SortKey) => {
    setCurrentKey(key);
    try { localStorage.setItem(STORAGE_KEY, key); } catch {}
    try {
      window.dispatchEvent(new CustomEvent('sort:change', { detail: { key } }));
    } catch {}

    if (!router || !pathname) return;
    const params = new URLSearchParams(searchParams?.toString());
    if (key === 'popular') {
      params.delete('sort'); // default
    } else {
      params.set('sort', key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Sync from URL if user navigates back/forward or external changes
  useEffect(() => {
    const q = (searchParams?.get('sort') || '').toLowerCase();
    if (q === 'price-asc' || q === 'price-desc' || q === 'popular') {
      if (q !== currentKey) setCurrentKey(q as SortKey);
    } else if (currentKey !== 'popular') {
      setCurrentKey('popular');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleCycle = () => {
    const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
    const nextKey = SORT_OPTIONS[nextIndex].key;
    commitSort(nextKey);
  };

  return (
    <button
      type="button"
      aria-pressed={true}
      className={cn(
        'inline-flex items-center gap-2 bg-gray-200 px-5 h-[52px] rounded-2xl cursor-pointer select-none',
        'transition-transform active:scale-[0.98] hover:brightness-95',
        className
      )}
      onClick={handleCycle}
    >
      <ArrowUpDown size={16} />
      <b>Сортировка:</b>
      <b className="text-primary">{SORT_OPTIONS[currentIndex].label}</b>
    </button>
  );
};