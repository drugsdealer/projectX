import Link from "next/link";
import type { ReactNode } from "react";
import { PICKUP } from "@/lib/company";

/**
 * Короткий блок доверия: как проходит заказ, доставка и возврат — без громких обещаний,
 * только то, что написано в условиях (/shipping, /returns).
 *  • variant="row"     — полоса на главной: 4 пункта (2×2 на телефоне);
 *  • variant="compact" — три строки в карточке товара под кнопкой доставки.
 */

const icon = "h-5 w-5 shrink-0 text-black/70";

const ICONS: Record<string, ReactNode> = {
  check: (
    <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
      <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
    </svg>
  ),
  route: (
    <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 6h8a3 3 0 010 6H9a3 3 0 000 6h8" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
    </svg>
  ),
};

const ITEMS = [
  {
    icon: "check",
    title: "Оригинал",
    text: "Две проверки: при выкупе и после прибытия в Россию",
    href: "/about",
  },
  {
    icon: "route",
    title: "До 14 рабочих дней",
    text: "Выкуп → проверка → доставка. Статус — в личном кабинете",
    href: "/shipping",
  },
  {
    icon: "pin",
    title: "Москва — бесплатно",
    text: `Курьер или самовывоз у м. ${PICKUP.metro.name}. По России — СДЭК`,
    href: "/shipping",
  },
  {
    icon: "back",
    title: "Возврат 14 дней",
    text: "Если не носили. Кроме парфюма и косметики",
    href: "/returns",
  },
] as const;

export default function TrustStrip({
  variant = "row",
  className = "",
  noReturn = false,
}: {
  variant?: "row" | "compact";
  className?: string;
  /** Парфюм и косметику по закону (Постановление № 55) вернуть нельзя — строку о возврате не показываем. */
  noReturn?: boolean;
}) {
  if (variant === "compact") {
    // В карточке товара срок доставки уже есть строкой выше — показываем остальное.
    const items = ITEMS.filter((i) => i.icon !== "route" && !(noReturn && i.icon === "back")).map((i) =>
      i.icon === "back" ? { ...i, text: "Если вещь не носили и ярлыки на месте" } : i
    );
    return (
      <ul className={`space-y-2.5 ${className}`}>
        {items.map((it) => (
          <li key={it.title}>
            <Link href={it.href} className="group flex items-start gap-3 text-[13px] leading-5 text-black/60 transition hover:text-black">
              {ICONS[it.icon]}
              <span>
                <span className="font-semibold text-black">{it.title}</span> · {it.text}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-5 border-y border-black/10 py-5 sm:gap-x-8 sm:py-6 md:grid-cols-4 ${className}`}>
      {ITEMS.map((it) => (
        <Link key={it.title} href={it.href} className="group flex items-start gap-3">
          {ICONS[it.icon]}
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-5 text-black sm:text-sm">{it.title}</span>
            <span className="mt-0.5 block text-[12px] leading-[17px] text-black/50 transition group-hover:text-black/70 sm:text-[13px] sm:leading-5">
              {it.text}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
