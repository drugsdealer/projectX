'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { HomePromoProduct } from '@/components/home/promos/types';

const BANNER =
  'https://res.cloudinary.com/dc57mpiao/image/upload/v1774993505/plp_0_pc_3840_1800_bnvuth.avif';
const BANNER_MOBILE =
  'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992864/story_1_campaign_imgs_pc_1600x1080_xkwj1s.avif';

const STATIC_PRODUCTS = [
  {
    id: 10001,
    name: 'ALIO 01',
    cat: 'Солнцезащитные очки',
    price: '18 500 ₽',
    tag: 'новинка',
    tagType: 'новинка',
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992851/11004945_D_45_eys302.avif',
  },
  {
    id: 10002,
    name: 'LILIT 02',
    cat: 'Солнцезащитные очки',
    price: '15 725 ₽',
    oldPrice: '18 500 ₽',
    tag: '−15%',
    tagType: 'скидка',
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992850/11004936_D_45_ajjheo.avif',
  },
  {
    id: 10003,
    name: 'MUSEE 02',
    cat: 'Оптические очки',
    price: '22 000 ₽',
    tag: 'новинка',
    tagType: 'новинка',
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992851/11004932_D_45_m4jscx.avif',
  },
  {
    id: 10004,
    name: 'HEIZER 03',
    cat: 'Солнцезащитные очки',
    price: '19 900 ₽',
    tag: 'новинка',
    tagType: 'новинка',
    img: 'https://res.cloudinary.com/dc57mpiao/image/upload/v1774992850/11004930_D_45_atvdka.avif',
  },
];

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

export default function GentleMonsterSpotlight({ items }: Props) {
  const isMobile = useIsMobile(768);
  const hasDbItems = items && items.length > 0;

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
      <div
        style={{
          display: 'block',
          position: 'relative',
          margin: isMobile ? '0 16px' : '0',
        }}
      >
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
      {hasDbItems ? (
        /* Карточки из БД */
        isMobile ? (
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
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} fill style={{ objectFit: 'cover' }} />
                    ) : null}
                  </div>
                  <div style={{ padding: '8px 2px 10px' }}>
                    {item.brandName ? (
                      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 3 }}>
                        {item.brandName}
                      </div>
                    ) : null}
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
                }}
              >
                <div style={{ position: 'relative', background: '#f4f4f2', overflow: 'hidden', aspectRatio: '1/1' }}>
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.name} fill style={{ objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{ padding: '10px 4px 14px' }}>
                  {item.brandName ? (
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 3 }}>
                      {item.brandName}
                    </div>
                  ) : null}
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
        )
      ) : (
        /* Статические карточки */
        isMobile ? (
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
              {STATIC_PRODUCTS.map((p) => (
                <Link
                  key={p.id}
                  href={`/product/${p.id}`}
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
                    <Image src={p.img} alt={p.name} fill style={{ objectFit: 'cover' }} />
                    <div
                      style={{
                        position: 'absolute', top: 7, left: 7,
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '3px 6px', borderRadius: 2, lineHeight: 1,
                        background: p.tagType === 'скидка' ? '#555' : '#f80606',
                        color: '#fff',
                      }}
                    >
                      {p.tag}
                    </div>
                    <HeartButton />
                  </div>
                  <div style={{ padding: '8px 2px 10px' }}>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 3 }}>
                      {p.cat}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 5 }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>{p.price}</span>
                      {p.oldPrice && (
                        <span style={{ fontSize: 10, color: '#bbb', textDecoration: 'line-through' }}>{p.oldPrice}</span>
                      )}
                    </div>
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
            {STATIC_PRODUCTS.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.id}`}
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
                  <Image src={p.img} alt={p.name} fill style={{ objectFit: 'cover' }} />
                  <div
                    style={{
                      position: 'absolute', top: 7, left: 7,
                      fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '3px 6px', borderRadius: 2, lineHeight: 1,
                      background: p.tagType === 'скидка' ? '#555' : '#f80606',
                      color: '#fff',
                    }}
                  >
                    {p.tag}
                  </div>
                  <HeartButton />
                </div>
                <div style={{ padding: '10px 4px 14px' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 3 }}>
                    {p.cat}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 5 }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{p.price}</span>
                    {p.oldPrice && (
                      <span style={{ fontSize: 10, color: '#bbb', textDecoration: 'line-through' }}>{p.oldPrice}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
