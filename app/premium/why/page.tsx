// app/premium/why/page.tsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import styles from "./WhyStagePremium.module.css";
import Image from "next/image";

export default function WhyStagePremium() {
  const [currentFrame, setCurrentFrame] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const frames = [
    {
      title: "Почему Stage Premium?",
      description: "Исключительное качество, инновационный дизайн и премиальный опыт",
    },
    {
      title: "Эксклюзивные материалы",
      description: "Только лучшие материалы, отобранные вручную для непревзойденного качества и комфорта."
    },
    {
      title: "Инновационный дизайн",
      description: "Уникальные модели, созданные ведущими дизайнерами с вниманием к каждой детали."
    },
    {
      title: "Ограниченный выпуск",
      description: "Каждая модель выпускается ограниченным тиражом, подчеркивая ваш исключительный стиль."
    },
    {
      title: "Премиум опыт",
      description: "От упаковки до обслуживания — мы обеспечиваем полное погружение в мир люксовых товаров."
    },
    {
      title: "Присоединяйтесь к Stage Premium",
      description: "Станьте частью эксклюзивного сообщества, оценив преимущества премиального качества.",
    },
    {
      title: "С Любовью команда Stage Store❤️",
      description: "Спасибо за каждый доверенный вами заказ нам, мы это очень ценим.",
    }
  ];

  // 45 фоток (в 3 раза больше) для максимального хаоса
  const randomPhotos = useMemo(
    () => Array.from({ length: 45 }, (_, i) => `/img/${(i % 15) + 1}.jpg`),
    []
  );

  // Детерминированные позиции (без Math.random)
  const photoPositions = useMemo(
    () => randomPhotos.map((_, index) => {
      // Используем детерминированные вычисления на основе индекса
      const angle = (index * 137.5) % 360;
      const distance = 30 + (index * 47) % 40;
      const left = 50 + Math.cos(angle * Math.PI / 180) * distance;
      const top = 50 + Math.sin(angle * Math.PI / 180) * distance;
      
      // Детерминированные значения на основе индекса
      const rotation = (index * 23) % 360 - 180;
      const zIndex = index % 10;
      const scale = 0.8 + (index * 0.123) % 0.8;
      const delay = (index * 0.234) % 2;
      const speed = 3 + (index * 0.345) % 4;
      
      return {
        left: `${left}%`,
        top: `${top}%`,
        rotation,
        zIndex,
        scale,
        delay,
        speed
      };
    }),
    [randomPhotos]
  );

  const [randomPremiumImages, setRandomPremiumImages] = useState<string[]>([]);

  useEffect(() => {
    const shuffled = [...randomPhotos].sort(() => 0.5 - Math.random()).slice(0, 3);
    setRandomPremiumImages(shuffled);
  }, [randomPhotos]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (isScrolling.current) return;
      isScrolling.current = true;

      const direction = e.deltaY > 0 ? 1 : -1;
      const newFrame = Math.max(0, Math.min(frames.length - 1, currentFrame + direction));
      
      if (newFrame !== currentFrame) {
        setCurrentFrame(newFrame);
      }

      setTimeout(() => {
        isScrolling.current = false;
      }, 800);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentFrame(prev => Math.min(frames.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentFrame(prev => Math.max(0, prev - 1));
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touchStartY = e.touches[0].clientY;
      
      const handleTouchEnd = (e: TouchEvent) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        
        if (Math.abs(diff) > 50) {
          const direction = diff > 0 ? 1 : -1;
          setCurrentFrame(prev => Math.max(0, Math.min(frames.length - 1, prev + direction)));
        }
        
        document.removeEventListener('touchend', handleTouchEnd);
      };
      
      document.addEventListener('touchend', handleTouchEnd);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    container.addEventListener('touchstart', handleTouchStart);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('touchstart', handleTouchStart);
    };
  }, [currentFrame, frames.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const zSpacing = -1500;
    const framesElements = container.querySelectorAll(`.${styles.frame}`);
    const photoElements = container.querySelectorAll(`.${styles.floatingPhoto}`);
    
    framesElements.forEach((frame, i) => {
      const element = frame as HTMLElement;
      const zPosition = (i - currentFrame) * zSpacing;
      const scale = 1 + Math.abs(zPosition) / 5000;
      const blur = Math.min(10, Math.abs(zPosition) / 200);
      
      element.style.transform = `translateZ(${zPosition}px) scale(${scale})`;
      element.style.opacity = Math.abs(zPosition) < Math.abs(zSpacing) / 1.2 ? '1' : '0';
      element.style.filter = `blur(${blur}px)`;
    });

    // Анимация для плавающих фото
    photoElements.forEach((photo, i) => {
      const element = photo as HTMLElement;
      const zPosition = (i % 15 - currentFrame) * zSpacing * 0.5;
      const scale = 0.7 + Math.abs(zPosition) / 6000;
      
      element.style.transform = `translateZ(${zPosition}px) scale(${scale}) rotate(${photoPositions[i].rotation}deg)`;
      element.style.opacity = Math.abs(zPosition) < Math.abs(zSpacing) / 1.1 ? '0.9' : '0';
    });
  }, [currentFrame]);

  const goToFrame = (index: number) => {
    setCurrentFrame(index);
  };

  // Скрыть header только на этой странице
  useEffect(() => {
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';

    return () => {
      if (header) header.style.display = '';
    };
  }, []);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.backButton}>
        <a
          href="/premium"
          className={styles.backLink}
          style={{
            fontSize: "1.1rem",
            fontWeight: "600",
            color: "#ffffff",
            background: "rgba(255,255,255,0.08)",
            padding: "10px 18px",
            borderRadius: "10px",
            textDecoration: "none",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            backdropFilter: "blur(6px)",
            marginTop: "40px"
          }}
        >
          ← Назад в Stage Premium
        </a>
      </div>

      <div className={styles.framesContainer}>
        {frames.map((frame, index) => (
          frame.title === "Почему Stage Premium?" ? (
            <div key={index} className={styles.frame}>
              <div className={styles.textContent}>
                <h2 className={styles.title}>★ {frame.title}</h2>
                <p className={styles.description}>{frame.description}</p>
              </div>
            </div>
          ) : (
            <div
              key={index}
              className={styles.frame}
            >
              <div className={styles.textContent}>
                <h2 className={styles.title}>{frame.title}</h2>
                <p className={styles.description}>{frame.description}</p>
              </div>
            </div>
          )
        ))}
      </div>

      <div className={styles.scrollIndicator}>
        {frames.map((_, index) => (
          <div
            key={index}
            className={`${styles.indicatorDot} ${index === currentFrame ? styles.active : ''}`}
            onClick={() => goToFrame(index)}
          />
        ))}
      </div>

      <div className={styles.scrollHint}>
        <span>
          {currentFrame === frames.length - 1 ? 'Вы дошли до конца :)' : 'Листайте вниз'}
        </span>
        {currentFrame !== frames.length - 1 && (
          <div className={styles.scrollArrow}>↓</div>
        )}
      </div>
    </div>
  );
}