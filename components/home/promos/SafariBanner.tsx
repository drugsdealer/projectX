'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { productPath } from "@/lib/product-url";

const SAFARI_IMAGE =
  "https://ik.imagekit.io/qowmy92ny/ChatGPT%20Image%2026%20%D0%BC%D0%B0%D1%8F%202026%20%D0%B3.,%2022_23_13.png";

type SafariProduct = {
  id: number;
  name: string;
  price?: number | null;
  oldPrice?: number | null;
  imageUrl?: string | null;
  images?: string[];
  Brand?: { id: number; name: string; slug: string } | null;
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

function ProductCard({ product, isMobile }: { product: SafariProduct; isMobile: boolean }) {
  const [hovered, setHovered] = useState(false);
  const href = productPath({ id: product.id, name: product.name, brandName: product.Brand?.name ?? undefined });
  const imgSrc =
    product.imageUrl ||
    (Array.isArray(product.images) ? product.images.find(Boolean) : null) ||
    null;
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
        boxShadow: hovered
          ? "0 4px 20px rgba(0,0,0,0.13)"
          : "0 1px 4px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.2s",
        borderRadius: 6,
        overflow: "hidden",
        ...(isMobile && { minWidth: 148, maxWidth: 148 }),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent strip */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #c8a96a, #8b5e2f)" }} />

      {/* Image */}
      <div style={{ position: "relative", background: "#faf8f5", overflow: "hidden", aspectRatio: "1/1" }}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              padding: "10px",
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
        {product.Brand?.name && (
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
            {product.Brand.name}
          </div>
        )}
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
          <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, color: "#111" }}>
            {priceStr}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function SafariBanner() {
  const isMobile = useIsMobile(768);
  const [products, setProducts] = useState<SafariProduct[]>([]);

  useEffect(() => {
    fetch("/api/collection/safari")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.items)) setProducts(data.items);
      })
      .catch(() => {});
  }, []);

  const displayProducts = products.slice(0, isMobile ? 4 : 6);

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
          gap: 10,
        }}
      >
        {/* Accent paw/sun icon */}
        <span style={{ fontSize: isMobile ? 16 : 20, lineHeight: 1 }}>🌿</span>
        <h2
          style={{
            fontSize: isMobile ? 15 : 20,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textAlign: "center",
            margin: 0,
            color: "#111",
          }}
        >
          Зов саванны
        </h2>
        <span style={{ fontSize: isMobile ? 16 : 20, lineHeight: 1 }}>🐆</span>
      </div>

      {/* Sub-label */}
      <p
        style={{
          textAlign: "center",
          fontSize: isMobile ? 11 : 13,
          color: "#888",
          letterSpacing: "0.04em",
          marginBottom: isMobile ? 12 : 18,
          padding: isMobile ? "0 16px" : 0,
        }}
      >
        Анималистичные принты — леопард, зебра, корова
      </p>

      {/* Banner photo */}
      <div
        style={{
          position: "relative",
          margin: isMobile ? "0 16px" : "0",
          borderRadius: isMobile ? 16 : 20,
          overflow: "hidden",
        }}
      >
        <img
          src={SAFARI_IMAGE}
          alt="Зов саванны"
          style={{
            width: "100%",
            display: "block",
            objectFit: "cover",
            maxHeight: isMobile ? 220 : 360,
            minHeight: isMobile ? 160 : 260,
          }}
        />
        {/* Sandy gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 60%, rgba(15,10,5,0.72) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Bottom text inside photo */}
        <div
          style={{
            position: "absolute",
            bottom: isMobile ? 12 : 16,
            left: isMobile ? 14 : 20,
          }}
        >
          <div
            style={{
              fontSize: isMobile ? 9 : 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,220,160,0.9)",
              marginBottom: 3,
            }}
          >
            Подборка Stage Store
          </div>
          <div
            style={{
              fontSize: isMobile ? 18 : 26,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.02em",
              textShadow: "0 2px 10px rgba(0,0,0,0.4)",
            }}
          >
            Зов саванны
          </div>
        </div>
      </div>

      {/* Product cards */}
      {displayProducts.length > 0 && (
        isMobile ? (
          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              marginTop: -46,
              paddingBottom: 8,
            }}
          >
            <div style={{ display: "flex", gap: 10, padding: "0 16px", width: "max-content" }}>
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
              gap: 16,
              paddingTop: 20,
              marginTop: -90,
              position: "relative",
              zIndex: 1,
            }}
          >
            {displayProducts.map((p) => (
              <ProductCard key={p.id} product={p} isMobile={false} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
