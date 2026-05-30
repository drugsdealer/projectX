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

function ProductCard({ product, isMobile }: { product: SafariProduct; isMobile: boolean }) {
  const [hovered, setHovered] = useState(false);
  const href = productPath({ id: product.id, name: product.name, brandName: product.Brand?.name ?? undefined });
  const imgSrc =
    product.imageUrl ||
    (Array.isArray(product.images) ? product.images.find(Boolean) : null) ||
    null;
  const price = typeof product.price === "number" && product.price > 0
    ? `от ${product.price.toLocaleString("ru-RU")} ₽`
    : null;

  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: "#fff",
        cursor: "pointer",
        boxShadow: hovered ? "0 6px 24px rgba(0,0,0,0.14)" : "0 2px 8px rgba(0,0,0,0.08)",
        transition: "box-shadow 0.2s",
        borderRadius: 8,
        overflow: "hidden",
        ...(isMobile && { minWidth: 144, maxWidth: 144 }),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Earthy accent line */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #c8a05a, #7a4f2a)" }} />

      {/* Image */}
      <div style={{ background: "#faf8f4", overflow: "hidden", aspectRatio: "1/1" }}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              padding: 8,
              display: "block",
              transition: "transform 0.35s",
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#eee" }} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: isMobile ? "7px 8px 9px" : "9px 10px 12px" }}>
        {product.Brand?.name && (
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaa", marginBottom: 3 }}>
            {product.Brand.name}
          </div>
        )}
        <div
          style={{
            fontSize: isMobile ? 11 : 12,
            fontWeight: 700,
            color: "#111",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            marginBottom: price ? 4 : 0,
          }}
        >
          {product.name}
        </div>
        {price && (
          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: "#111" }}>
            {price}
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
      .then((data) => { if (Array.isArray(data?.items)) setProducts(data.items); })
      .catch(() => {});
  }, []);

  const displayProducts = products.slice(0, isMobile ? 4 : 6);
  const photoHeight = isMobile ? 260 : 420;
  // Cards overlap photo by this amount — keep photo mostly visible
  const cardOverlap = isMobile ? 40 : 60;

  return (
    <div style={{ background: "#fff", width: "100%", paddingTop: isMobile ? 20 : 32, paddingBottom: isMobile ? 20 : 32 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", fontFamily: "'Nunito', sans-serif" }}>

        {/* Photo with ALL text inside */}
        <div
          style={{
            position: "relative",
            height: photoHeight,
            borderRadius: isMobile ? 16 : 22,
            overflow: "hidden",
            margin: isMobile ? "0 0" : "0",
          }}
        >
          <img
            src={SAFARI_IMAGE}
            alt="Зов саванны"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />

          {/* Gradient: stronger on left for text, bottom for cards */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.0) 100%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(10,6,2,0.75) 0%, rgba(0,0,0,0.0) 50%)",
            pointerEvents: "none",
          }} />

          {/* Text overlay — top-left */}
          <div style={{ position: "absolute", top: isMobile ? 16 : 24, left: isMobile ? 16 : 28 }}>
            <div style={{
              fontSize: isMobile ? 9 : 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(255,215,140,0.88)",
              marginBottom: 6,
            }}>
              Подборка Stage Store
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 6 : 8,
              marginBottom: isMobile ? 5 : 7,
            }}>
              <span style={{ fontSize: isMobile ? 18 : 24 }}>🌿</span>
              <h2 style={{
                margin: 0,
                fontSize: isMobile ? 22 : 32,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: "#fff",
                textShadow: "0 2px 10px rgba(0,0,0,0.4)",
              }}>
                Зов саванны
              </h2>
              <span style={{ fontSize: isMobile ? 18 : 24 }}>🐆</span>
            </div>
            <p style={{
              margin: 0,
              fontSize: isMobile ? 11 : 13,
              color: "rgba(255,255,255,0.75)",
              letterSpacing: "0.02em",
            }}>
              Анималистичные принты — леопард, зебра, корова
            </p>
          </div>
        </div>

        {/* Product cards — sit right at the bottom edge of photo */}
        {displayProducts.length > 0 && (
          isMobile ? (
            <div style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              marginTop: -cardOverlap,
              paddingBottom: 4,
            }}>
              <div style={{ display: "flex", gap: 8, padding: "0 0 0 0", width: "max-content" }}>
                {displayProducts.map((p) => (
                  <ProductCard key={p.id} product={p} isMobile={true} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${displayProducts.length}, 1fr)`,
              gap: 14,
              marginTop: -cardOverlap,
              position: "relative",
              zIndex: 1,
            }}>
              {displayProducts.map((p) => (
                <ProductCard key={p.id} product={p} isMobile={false} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
