/**
 * Motivos visuales del quipu: la cuerda madre con hebras anudadas (marca)
 * y el nudo individual que marca cada producto según su urgencia.
 */

/** Marca: cuerda madre horizontal con hebras colgantes anudadas. */
export function QuipuMark({ width = 132, tone = "light" }: { width?: number; tone?: "light" | "dark" }) {
  const cord = tone === "light" ? "oklch(0.95 0.02 315 / 0.9)" : "var(--chicha)";
  const knots =
    tone === "light"
      ? ["oklch(0.78 0.12 358)", "oklch(0.8 0.1 152)", "oklch(0.85 0.09 85)", "oklch(0.78 0.12 358)"]
      : ["var(--qantu)", "var(--fresco)", "var(--pronto)", "var(--qantu)"];
  const strands = [
    { x: 16, len: 30, knotY: 20 },
    { x: 44, len: 42, knotY: 30 },
    { x: 72, len: 34, knotY: 16 },
    { x: 100, len: 46, knotY: 34 },
  ];
  return (
    <svg
      width={width}
      viewBox="0 0 116 60"
      fill="none"
      aria-hidden
      style={{ display: "block", overflow: "visible" }}
    >
      {/* cuerda madre */}
      <path
        d="M2 6 Q 30 2, 58 6 T 114 6"
        stroke={cord}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {strands.map((s, i) => (
        <g key={s.x}>
          <path
            d={`M${s.x} 7 q ${i % 2 === 0 ? 2 : -2} ${s.len / 2}, 0 ${s.len}`}
            stroke={cord}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* nudo: doble vuelta */}
          <circle cx={s.x} cy={7 + s.knotY} r="3.6" fill={knots[i]} />
          <circle
            cx={s.x}
            cy={7 + s.knotY}
            r="5.4"
            stroke={knots[i]}
            strokeWidth="1.4"
            opacity="0.45"
            fill="none"
          />
        </g>
      ))}
    </svg>
  );
}

/** Nudo de estado: círculo anudado sobre la cuerda vertical de una sección. */
export function Knot({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="5" fill={color} />
      <circle cx="10" cy="10" r="8" stroke={color} strokeWidth="1.6" opacity="0.35" fill="none" />
    </svg>
  );
}

/** Quipu vacío para estados sin datos: hebras sin nudos. */
export function QuipuEmpty() {
  return (
    <svg width="180" viewBox="0 0 160 90" fill="none" aria-hidden style={{ display: "block" }}>
      <path d="M8 10 Q 44 4, 80 10 T 152 10" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
      {[28, 62, 96, 130].map((x, i) => (
        <path
          key={x}
          d={`M${x} 12 q ${i % 2 === 0 ? 3 : -3} ${20 + i * 6}, 0 ${40 + i * 10}`}
          stroke="var(--line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 7"
        />
      ))}
    </svg>
  );
}
