'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { HomePromoProduct } from '@/components/home/promos/types';

const BANNER =
  'https://res.cloudinary.com/dc57mpiao/image/upload/v1774993505/plp_0_pc_3840_1800_bnvuth.avif';
const BANNER_MOBILE =
  'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992864/story_1_campaign_imgs_pc_1600x1080_xkwj1s.avif';

const formatPrice = (price?: number | null) => {
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) return 'Цена по запросу';
  return `${price.toLocaleString('ru-RU')} ₽`;
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

function HeartButton() {
  const [filled, setFilled] = useState(false);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFilled((v) => !v); }}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label="В избранное"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 15S2 10.5 2 6C2 4 3.8 2.5 6 2.5c1.4 0 2.6.9 3 2.2.4-1.3 1.6-2.2 3-2.2C14.2 2.5 16 4 16 6 16 10.5 9 15 9 15Z"
          stroke={filled ? '#e05555' : '#aaa'}
          strokeWidth="1.2"
          fill={filled ? '#e05555' : 'none'}
        />
      </svg>
    </button>
  );
}

type Props = {
  items?: HomePromoProduct[];
};

export default function GentleMonsterSpotlight({ items = [] }: Props) {
  const isMobile = useIsMobile(768);

  if (!items.length) return null;

  return (
    <div
      style={{
        fontFamily: "'Nunito', sans-serif",
        maxWidth: 1120,
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '24px 0 32px' : '40px 0 48px',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? 10 : 14,
          padding: isMobile ? '0 16px' : '0',
        }}
      >
        <div style={{ width: 56 }} />
        <h2
          style={{
            fontSize: isMobile ? 15 : 20,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
            flex: 1,
            margin: 0,
          }}
        >
          Gentle Monster — 2025 FALL
        </h2>
        <div style={{ width: 56 }} />
      </div>

      {/* Banner image */}
      <div style={{ display: 'block', position: 'relative', margin: isMobile ? '0 16px' : '0' }}>
        <picture>
          <source media="(max-width: 768px)" srcSet={BANNER_MOBILE} />
          <Image
            src={BANNER}
            alt="Gentle Monster 2025 FALL"
            width={1120}
            height={525}
            style={{ width: '100%', display: 'block', objectFit: 'cover', height: 'auto' }}
            priority
          />
        </picture>
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            fontSize: isMobile ? 9 : 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#fff',
          }}
        >
          Перейти к товарам →
        </div>
      </div>

      {/* Cards */}
      {isMobile ? (
        <div
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            marginTop: -50,
            paddingBottom: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 10, padding: '0 16px', width: 'max-content' }}>
            {items.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                href={`/product/${item.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: '#fff',
                  cursor: 'pointer',
                  minWidth: 148,
                  maxWidth: 148,
                }}
              >
                <div style={{ position: 'relative', background: '#f4f4f2', overflow: 'hidden', aspectRatio: '1/1' }}>
                  {item.imageUrl
                    ? <Image src={item.imageUrl} alt={item.name} fill style={{ objectFit: 'cover' }} />
                    : null}
                  <HeartButton />
                </div>
                <div style={{ padding: '8px 2px 10px' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 3 }}>
                    {item.brandName || 'Gentle Monster'}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 5 }}>
                    {item.name}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>
                    {formatPrice(item.price)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 19,
            paddingTop: 20,
            marginTop: -80,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {items.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href={`/product/${item.id}`}
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                background: '#fff',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
            >
              <div style={{ position: 'relative', background: '#f4f4f2', overflow: 'hidden', aspectRatio: '1/1' }}>
                {item.imageUrl
                  ? <Image src={item.imageUrl} alt={item.name} fill style={{ objectFit: 'cover' }} />
                  : null}
                <HeartButton />
              </div>
              <div style={{ padding: '10px 4px 14px' }}>
                <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 3 }}>
                  Солнцезащитные очки
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 5 }}>
                  {item.name}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                  {formatPrice(item.price)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
