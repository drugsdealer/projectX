"use client";

import { useState, useEffect } from "react";

// Компас Stone Island
function CompassBadge({ size = 48, color = "#fff", opacity = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={{ opacity }}>
      <circle cx="40" cy="40" r="37" stroke={color} strokeWidth="1.5" fill="none"/>
      <circle cx="40" cy="40" r="29" stroke={color} strokeWidth="1" fill="none" strokeDasharray="3 3"/>
      <line x1="40" y1="8"  x2="40" y2="72" stroke={color} strokeWidth="1"/>
      <line x1="8"  y1="40" x2="72" y2="40" stroke={color} strokeWidth="1"/>
      <polygon points="40,11 43,26 40,22 37,26" fill={color}/>
      <polygon points="40,69 43,54 40,58 37,54" fill={color} opacity="0.5"/>
      <polygon points="11,40 26,37 22,40 26,43" fill={color} opacity="0.5"/>
      <polygon points="69,40 54,37 58,40 54,43" fill={color} opacity="0.5"/>
      <text x="37" y="7" fill={color} fontSize="7" fontFamily="monospace" fontWeight="700">N</text>
      <circle cx="40" cy="40" r="3.5" fill={color}/>
      <circle cx="40" cy="40" r="1.5" fill="none" stroke={color} strokeWidth="1"/>
    </svg>
  );
}

const BANNER = "https://ik.imagekit.io/qowmy92ny/stage/banners/stone-island-aw.jpg";
const LOGO = "https://ik.imagekit.io/qowmy92ny/stage/brands/stone-island-logo.png";

export default function StoneIslandBanner() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

        .si-wrap {
          position: relative;
          width: 100%;
          overflow: hidden;
          font-family: 'Space Mono', monospace;
          cursor: crosshair;
        }

        .si-img {
          width: 100%;
          display: block;
          max-height: 72vh;
          min-height: 460px;
          object-fit: cover;
          object-position: center top;
          filter: sepia(8%) contrast(1.04);
          transition: transform 7s ease, filter 0.5s;
        }
        .si-wrap:hover .si-img {
          transform: scale(1.018);
          filter: sepia(0%) contrast(1.05);
        }

        .si-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,0.0) 0%,
            rgba(0,0,0,0.0) 40%,
            rgba(0,0,0,0.55) 70%,
            rgba(0,0,0,0.78) 100%
          );
          pointer-events: none;
        }

        /* компас — только он остаётся сверху */
        .si-top {
          position: absolute;
          top: 22px; right: 28px;
        }
        .si-badge-wrap {
          opacity: ${loaded ? 1 : 0};
          transform: ${loaded ? 'rotate(0deg)' : 'rotate(-20deg)'};
          transition: opacity 0.9s ease 0.3s, transform 1.2s ease 0.3s;
        }
        .si-badge-wrap:hover { animation: si-spin 8s linear infinite; }
        @keyframes si-spin { to { transform: rotate(360deg); } }

        /* нижний блок */
        .si-bottom {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 0 28px 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          text-align: center;
        }

        /* логотип над линией — чёрный PNG инвертируем в белый */
        .si-logo {
          width: clamp(200px, 28vw, 320px);
          object-fit: contain;
          display: block;
          filter: invert(1) brightness(2) contrast(1.2);
          opacity: ${loaded ? 1 : 0};
          transform: ${loaded ? 'translateY(0)' : 'translateY(12px)'};
          transition: opacity 0.8s ease 0.45s, transform 0.8s ease 0.45s;
        }

        .si-rule {
          width: 100%;
          height: 1px;
          background: rgba(255,255,255,0.22);
          transform-origin: left;
          transform: ${loaded ? 'scaleX(1)' : 'scaleX(0)'};
          transition: transform 0.9s ease 0.5s;
        }

        .si-lines {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .si-line {
          font-size: clamp(10px, 1.1vw, 13px);
          font-weight: 400;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(240,236,227,0.82);
          line-height: 1.5;
          opacity: ${loaded ? 1 : 0};
          transform: ${loaded ? 'translateY(0)' : 'translateY(10px)'};
        }
        .si-line:nth-child(1) { transition: opacity 0.7s ease 0.55s, transform 0.7s ease 0.55s; }
        .si-line:nth-child(2) { transition: opacity 0.7s ease 0.65s, transform 0.7s ease 0.65s; }
        .si-line:nth-child(3) { transition: opacity 0.7s ease 0.75s, transform 0.7s ease 0.75s; }

        .si-cta {
          background: none;
          border: 1px solid rgba(240,236,227,0.55);
          color: rgba(240,236,227,0.9);
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          padding: 12px 28px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          opacity: ${loaded ? 1 : 0};
          transform: ${loaded ? 'translateY(0)' : 'translateY(10px)'};
          transition: opacity 0.7s ease 0.85s, transform 0.7s ease 0.85s,
                      background 0.2s, border-color 0.2s, color 0.2s;
        }
        .si-cta:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(240,236,227,1);
          color: #fff;
        }
      `}</style>

      <div className="si-wrap">
        <img
          className="si-img"
          src={BANNER}
          alt="Stone Island AW Collection"
          onLoad={() => setLoaded(true)}
        />
        <div className="si-overlay" />

        {/* компас сверху справа */}
        <div className="si-top">
          <div className="si-badge-wrap">
            <CompassBadge size={44} color="#fff" opacity={0.75} />
          </div>
        </div>

        {/* низ */}
        <div className="si-bottom">
          {/* логотип над линией */}
          <img className="si-logo" src={LOGO} alt="Stone Island" />

          <div className="si-rule" />

          <div className="si-lines">
            <div className="si-line">Каждая вещь уникальна.</div>
            <div className="si-line">Нити из нержавеющей стали, кевлар,</div>
            <div className="si-line">а также термочувствительные ткани.</div>
          </div>
          <a
            href="https://stagestore.app/?search=stone%20island"
            className="si-cta"
          >
            Смотреть коллекцию →
          </a>
        </div>
      </div>
    </>
  );
}
