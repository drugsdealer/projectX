"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/context/ToastContext";

interface Props {
  title: string;
  /** Relative path e.g. /product/123 — we prepend SITE_URL at runtime */
  path: string;
}

const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://stagestore.app";

export function ShareButton({ title, path }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const url = `${SITE_URL}${path}`;
  const text = `${title} — Stage Store`;

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleShare = useCallback(async () => {
    // Native Web Share API (works great on mobile)
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        // User cancelled or API failed — fall through to popover
      }
    }
    // Desktop fallback: toggle popover
    setOpen((v) => !v);
  }, [text, url]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast({ title: "Ссылка скопирована", details: url });
      setTimeout(() => setCopied(false), 2000);
      setOpen(false);
    } catch {
      // Fallback for old browsers
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      showToast({ title: "Ссылка скопирована", details: url });
      setTimeout(() => setCopied(false), 2000);
      setOpen(false);
    }
  }, [url, showToast]);

  const platforms = [
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <path d="M20.7 4.2a1.1 1.1 0 0 0-1.1-.2L3.6 9.7c-.9.3-.9 1.6.1 1.9l4.2 1.3 1.6 4.6c.2.7 1.1.9 1.6.3l2.4-2.7 4.5 3.3c.6.4 1.4.1 1.6-.6l2.1-12.7c.1-.6-.4-1.2-1-1.1zm-2 2.3-1.7 9.9-3.8-2.8a.9.9 0 0 0-1.2.2l-1.7 2-.9-2.7a1 1 0 0 0-.6-.6l-2.6-.8 11.5-4.2-.8 3.4z" />
        </svg>
      ),
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      ),
    },
    {
      label: "VK",
      href: `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.864 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.169-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.169.508.271.508.22 0 .407-.136.813-.542 1.253-1.405 2.151-3.574 2.151-3.574.119-.254.322-.491.762-.491h1.744c.525 0 .643.271.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.202 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" />
        </svg>
      ),
    },
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleShare}
        aria-label="Поделиться"
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-black/12 text-sm font-medium text-black/70 hover:border-black/30 hover:text-black transition-colors"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          ) : (
            <motion.span
              key="share"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                <path
                  d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
        <span>{copied ? "Скопировано" : "Поделиться"}</span>
      </button>

      {/* Desktop popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-56 rounded-2xl border border-black/10 bg-white shadow-2xl shadow-black/8 overflow-hidden"
          >
            <div className="p-1.5">
              {/* Copy link */}
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-black/5 transition text-left"
              >
                <span className="w-7 h-7 rounded-lg bg-black/6 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Скопировать ссылку
              </button>

              <div className="my-1 mx-2 border-t border-black/6" />

              {/* Social platforms */}
              {platforms.map((p) => (
                <a
                  key={p.label}
                  href={p.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-black/5 transition"
                >
                  <span className="w-7 h-7 rounded-lg bg-black/6 flex items-center justify-center shrink-0">
                    {p.icon}
                  </span>
                  {p.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
