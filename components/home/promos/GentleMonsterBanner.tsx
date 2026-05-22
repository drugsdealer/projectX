'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { productPath } from "@/lib/product-url";

const BANNER_PC =
  "https://ik.imagekit.io/qowmy92ny/plp_0_pc_3840_1800.avif";
const BANNER_MOB =
  "https://ik.imagekit.io/qowmy92ny/pdp_1_pcmob.avif";

export type GentleMonsterProduct = {
  id: number;
  name: string;
  price?: number | null;
  imageUrl?: string | null;
  brandName?: string | null;
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

function formatPrice(price?: number | null) {
  if (typeof price !== "number" || price <= 0) return null;
  return `от ${price.toLocaleString("ru-RU")} ₽`;
}

function ProductCard({
  product,
  isMobile,
}: {
  product: GentleMonsterProduct;
  isMobile: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const href = productPath({ id: product.id, name: product.name, brandName: product.brandName ?? undefined });
  const priceStr = formatPrice(product.price);

  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: "#fff",
        cursor: "pointer",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.2s",
        borderRadius: 4,
        overflow: "hidden",
        ...(isMobile && { minWidth: 148, maxWidth: 148 }),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div
        style={{
          position: "relative",
          background: "#f4f4f2",
          overflow: "hidden",
          aspectRatio: "1/1",
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "transform 0.4s",
              transform: hovered ? "scale(1.04)" : "scale(1)",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#eee" }} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: isMobile ? "8px 8px 10px" : "10px 10px 14px" }}>
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#999",
            marginBottom: 3,
          }}
        >
          Gentle Monster
        </div>
        <div
          style={{
            fontSize: isMobile ? 11 : 13,
            fontWeight: 700,
            color: "#111",
            lineHeight: 1.3,
            marginBottom: 5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </div>
        {priceStr && (
          <div
            style={{
              fontSize: isMobile ? 11 : 13,
              fontWeight: 700,
              color: "#111",
            }}
          >
            {priceStr}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function GentleMonsterBanner({
  products,
}: {
  products: GentleMonsterProduct[];
}) {
  const isMobile = useIsMobile(768);

  if (!products.length) return null;

  const displayProducts = products.slice(0, 4);

  return (
    <div
      style={{
        fontFamily: "'Nunito', sans-serif",
        maxWidth: 1120,
        width: "100%",
        margin: "0 auto",
        padding: isMobile ? "24px 0 32px" : "40px 0 48px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: isMobile ? 10 : 14,
          padding: isMobile ? "0 16px" : "0",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? 15 : 20,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textAlign: "center",
            margin: 0,
          }}
        >
          Gentle Monster — 2025 FALL
        </h2>
      </div>

      {/* Banner */}
      <Link
        href="/brand/gentle-monster"
        style={{
          display: "block",
          position: "relative",
          margin: isMobile ? "0 16px" : "0",
        }}
      >
        <picture>
          <source media="(max-width: 768px)" srcSet={BANNER_MOB} />
          <img
            src={BANNER_PC}
            alt="Gentle Monster 2025 FALL"
            style={{ width: "100%", display: "block", objectFit: "cover" }}
          />
        </picture>
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            fontSize: isMobile ? 9 : 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          Перейти к товарам →
        </div>
      </Link>

      {/* Product cards */}
      {isMobile ? (
        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            marginTop: -50,
            paddingBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "0 16px",
              width: "max-content",
            }}
          >
            {displayProducts.map((p) => (
              <ProductCard key={p.id} product={p} isMobile={true} />
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${displayProducts.length}, 1fr)`,
            gap: 19,
            paddingTop: 20,
            marginTop: -80,
            position: "relative",
            zIndex: 1,
          }}
        >
          {displayProducts.map((p) => (
            <ProductCard key={p.id} product={p} isMobile={false} />
          ))}
        </div>
      )}
    </div>
  );
}
