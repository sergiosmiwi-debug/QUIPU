"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleNotch, TrashSimple } from "@phosphor-icons/react";
import { apiJson } from "@/lib/device";
import type { DashboardData } from "@/lib/types";

type Period = "semana" | "mes" | "todo";

const PERIODS: { id: Period; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "todo", label: "Todo" },
];

/* Equivalencias honestas para dimensionar la plata perdida (menú ~S/ 12). */
function equivalence(total: number): string | null {
  if (total <= 0) return null;
  const menus = total / 12;
  if (menus < 1) return "Menos que un menú — buen trabajo.";
  if (menus < 2) return "Eso era un menú del día.";
  return `Eso eran ${Math.floor(menus)} menús del día.`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

export default function HuellaPage() {
  const [period, setPeriod] = useState<Period>("todo");
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async (p: Period) => {
    setData(null);
    try {
      setData(await apiJson<DashboardData>(`/dashboard?period=${p}`));
    } catch {
      setData({ total_lost: 0, waste: [], status_counts: { fresh: 0, warning: 0, danger: 0, expired: 0 } });
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  async function removeEntry(id: number) {
    setBusy(id);
    try {
      await apiJson(`/dashboard/waste/${id}`, { method: "DELETE" });
      setData((prev) =>
        prev
          ? {
              ...prev,
              waste: prev.waste.filter((w) => w.id !== id),
              total_lost: prev.waste
                .filter((w) => w.id !== id)
                .reduce((s, w) => s + w.price * w.quantity, 0),
            }
          : prev
      );
    } catch {
      /* silencioso: la fila queda */
    } finally {
      setBusy(null);
    }
  }

  const counts = data?.status_counts;
  const alive = counts ? counts.fresh + counts.warning + counts.danger : 0;
  const eq = data ? equivalence(data.total_lost) : null;

  return (
    <main>
      <header className="px-5 pt-10 pb-6" style={{ background: "var(--chicha)", color: "#fff" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1.12 }}>
          Tu huella
        </h1>
        <p className="mt-1.5" style={{ fontSize: 14.5, color: "oklch(0.88 0.03 315)" }}>
          Lo que se perdió y lo que salvaste a tiempo.
        </p>

        {/* Periodo */}
        <div className="flex gap-1.5 mt-4" role="tablist" aria-label="Periodo">
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.id)}
                className="rounded-full px-4 py-1.5 font-semibold transition-colors"
                style={{
                  fontSize: 13,
                  background: active ? "var(--surface)" : "oklch(1 0 0 / 0.14)",
                  color: active ? "var(--chicha)" : "oklch(0.92 0.02 315)",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-5 pt-5">
        {data === null ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "var(--ink-faint)" }}>
            <CircleNotch size={18} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Contando los nudos…</span>
          </div>
        ) : (
          <>
            {/* Plata perdida */}
            <section className="anim-rise">
              <p style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>Comida que se perdió</p>
              <p
                className="mt-0.5"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 44,
                  lineHeight: 1.05,
                  color: data.total_lost > 0 ? "var(--urgente-ink)" : "var(--fresco-ink)",
                }}
              >
                S/ {data.total_lost.toFixed(2)}
              </p>
              {eq && (
                <p className="mt-1" style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
                  {eq}
                </p>
              )}
            </section>

            {/* Estado actual de la despensa */}
            {counts && alive + counts.expired > 0 && (
              <section className="mt-6 anim-rise" style={{ animationDelay: "80ms" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--ink)" }}>
                  Tu despensa hoy
                </h2>
                {/* barra proporcional por estado */}
                <div className="flex h-3 rounded-full overflow-hidden mt-2.5" style={{ background: "var(--line-soft)" }} aria-hidden>
                  {counts.fresh > 0 && <div style={{ flex: counts.fresh, background: "var(--fresco)" }} />}
                  {counts.warning > 0 && <div style={{ flex: counts.warning, background: "var(--pronto)" }} />}
                  {counts.danger > 0 && <div style={{ flex: counts.danger, background: "var(--urgente)" }} />}
                  {counts.expired > 0 && <div style={{ flex: counts.expired, background: "var(--vencido)" }} />}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                  {[
                    { n: counts.fresh, label: "tranquilos", color: "var(--fresco)" },
                    { n: counts.warning, label: "esta semana", color: "var(--pronto)" },
                    { n: counts.danger, label: "hoy o mañana", color: "var(--urgente)" },
                    { n: counts.expired, label: "vencidos", color: "var(--vencido)" },
                  ]
                    .filter((s) => s.n > 0)
                    .map((s) => (
                      <span key={s.label} className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                        <span aria-hidden className="rounded-full inline-block" style={{ width: 8, height: 8, background: s.color }} />
                        {s.n} {s.label}
                      </span>
                    ))}
                </div>
              </section>
            )}

            {/* Registro de pérdidas */}
            <section className="mt-7 anim-rise" style={{ animationDelay: "140ms" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--ink)" }}>
                Nudos que se soltaron
              </h2>
              {data.waste.length === 0 ? (
                <p className="mt-2 py-6 text-center" style={{ fontSize: 14, color: "var(--ink-faint)" }}>
                  Nada desperdiciado en este periodo. Así se lleva un quipu.
                </p>
              ) : (
                <ul className="mt-2">
                  {data.waste.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderBottom: "1px solid var(--line-soft)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>
                          {w.product_name}
                          {w.quantity > 1 && (
                            <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}> ×{w.quantity}</span>
                          )}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>{fmtDate(w.wasted_at)}</p>
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--urgente-ink)" }}>
                        − S/ {(w.price * w.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeEntry(w.id)}
                        disabled={busy === w.id}
                        aria-label={`Borrar registro de ${w.product_name}`}
                        className="p-1.5 active:scale-90 transition-transform disabled:opacity-50"
                      >
                        <TrashSimple size={15} color="var(--ink-faint)" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
