"use client";

import Link from "next/link";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: "light" | "dark";
  error?: boolean;
  className?: string;
};

// Отдельная галочка согласия на обработку ПДн. С 1 сентября 2025 (156-ФЗ) согласие
// оформляется отдельно от оферты и прочих документов и не ставится заранее.
export default function PdConsentCheckbox({ checked, onChange, tone = "light", error = false, className = "" }: Props) {
  const dark = tone === "dark";
  return (
    <label className={`flex cursor-pointer items-start gap-3 text-xs leading-5 ${dark ? "text-white/60" : "text-black/60"} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded ${dark ? "accent-white" : "accent-black"}`}
        aria-invalid={error || undefined}
      />
      <span>
        Даю{" "}
        <Link
          href="/personal-data"
          target="_blank"
          className={`underline underline-offset-2 ${dark ? "hover:text-white" : "hover:text-black"}`}
        >
          согласие на обработку персональных данных
        </Link>
        {error && <span className="mt-1 block text-red-500">Отметьте согласие, чтобы продолжить</span>}
      </span>
    </label>
  );
}
