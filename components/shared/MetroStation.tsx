import React from "react";

/**
 * Станция метро с цветными точками линий — как на схеме метро.
 * Кунцевская, например, пересадочный узел: Филёвская, Арбатско-Покровская и БКЛ.
 */

/** Официальные цвета линий Московского метро */
const LINE_COLORS: Record<number, { color: string; name: string }> = {
  1: { color: "#EF161E", name: "Сокольническая" },
  2: { color: "#2DBE2C", name: "Замоскворецкая" },
  3: { color: "#0078BE", name: "Арбатско-Покровская" },
  4: { color: "#00BFFF", name: "Филёвская" },
  5: { color: "#8D5B2D", name: "Кольцевая" },
  6: { color: "#ED9121", name: "Калужско-Рижская" },
  7: { color: "#800080", name: "Таганско-Краснопресненская" },
  8: { color: "#FFCD1C", name: "Калининская" },
  9: { color: "#999999", name: "Серпуховско-Тимирязевская" },
  10: { color: "#99CC00", name: "Люблинско-Дмитровская" },
  11: { color: "#82C0C0", name: "Большая кольцевая" },
  12: { color: "#A1B3D4", name: "Бутовская" },
  14: { color: "#FFA8AF", name: "МЦК" },
  15: { color: "#DE64A1", name: "Некрасовская" },
};

export function MetroStation({
  name,
  lines,
  className = "",
}: {
  name: string;
  lines: number[];
  className?: string;
}) {
  const known = lines.map((n) => LINE_COLORS[n]).filter(Boolean);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {known.map((l, i) => (
          <span
            key={`${l.name}-${i}`}
            className="inline-block h-2 w-2 rounded-full ring-1 ring-black/5"
            style={{ backgroundColor: l.color }}
            title={l.name}
          />
        ))}
      </span>
      <span>{name}</span>
      {/* Для скринридеров перечисляем линии текстом */}
      <span className="sr-only">
        {known.length ? ` (${known.map((l) => l.name).join(", ")})` : ""}
      </span>
    </span>
  );
}

export default MetroStation;
