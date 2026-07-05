"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowCounterClockwise, CircleNotch, Coins, X } from "@phosphor-icons/react";
import HeaderWave from "@/components/HeaderWave";
import MusicButton from "@/components/MusicButton";
import { apiJson } from "@/lib/device";
import type { DashboardData, Status } from "@/lib/types";

type Period = "hoy" | "semana" | "mes" | "todo";

const PERIODS: { id: Period; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "todo", label: "Todo" },
];

const STATUS_META: { id: Status; label: string; color: string }[] = [
  { id: "fresh", label: "Frescos", color: "var(--fresh)" },
  { id: "warning", label: "Pronto", color: "var(--warn)" },
  { id: "danger", label: "Urgente", color: "var(--danger)" },
  { id: "expired", label: "Vencidos", color: "var(--muted)" },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("todo");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiJson<DashboardData>(`/dashboard?period=${period}`));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteEntry(id: number) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            waste: prev.waste.filter((w) => w.id !== id),
            total_lost:
              Math.round(
                (prev.total_lost -
                  (prev.waste.find((w) => w.id === id)?.price ?? 0) *
                    (prev.waste.find((w) => w.id === id)?.quantity ?? 1)) *
                  100
              ) / 100,
          }
        : prev
    );
    try {
      await apiJson(`/dashboard/waste/${id}`, { method: "DELETE" });
    } catch {}
  }

  async function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    try {
      await apiJson("/dashboard/reset", { method: "DELETE" });
      load();
    } catch {}
  }

  const counts = data?.status_counts ?? { fresh: 0, warning: 0, danger: 0, expired: 0 };
  const totalCount = STATUS_META.reduce((acc, s) => acc + (counts[s.id] ?? 0), 0);

  return (
    <main>
      <header
        className="sticky top-0 z-40 px-5 pt-12 pb-12"
        style={{ background: "var(--gradient-header)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                fontSize: 34,
                color: "#fff",
                lineHeight: 1.05,
              }}
            >
              Res<em style={{ color: "rgba(255,255,255,0.75)" }}>umen</em>
            </h1>
            <p
              className="uppercase mt-1"
              style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em" }}
            >
              Lo que pierdes al tirar comida
            </p>
          </div>
          <div className="pt-1">
            <MusicButton />
          </div>
        </div>

        {/* Filtro de período */}
        <div className="flex gap-1.5 mt-4">
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className="rounded-full px-3 py-1.5 font-semibold active:scale-95 transition-transform"
                style={{
                  fontSize: 12,
                  background: active ? "#fff" : "rgba(255,255,255,0.13)",
                  color: active ? "var(--brand)" : "rgba(255,255,255,0.85)",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <HeaderWave />
      </header>

      <div className="px-5 pt-3">
        {/* Dinero perdido */}
        <div
          className="anim-card p-5 flex items-center gap-4"
          style={{ background: "var(--surface)", borderRadius: 20, boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 52, height: 52, background: "var(--amber-bg)", borderRadius: 16 }}
          >
            <Coins size={26} color="var(--amber)" weight="duotone" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: "var(--ink-3)" }}>Dinero perdido en comida tirada</p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                fontSize: 38,
                lineHeight: 1.1,
                color: "var(--ink-1)",
              }}
            >
              S/ {(data?.total_lost ?? 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Conteos por estado + barra apilada */}
        <div
          className="anim-card p-5 mt-3"
          style={{
            background: "var(--surface)",
            borderRadius: 20,
            boxShadow: "var(--shadow-card)",
            animationDelay: "60ms",
          }}
        >
          <p className="font-semibold mb-3" style={{ fontSize: 13, color: "var(--ink-2)" }}>
            Tu inventario ahora
          </p>
          {totalCount === 0 ? (
            <p style={{ fontSize: 12, color: "var(--ink-3)" }}>Sin productos registrados aún.</p>
          ) : (
            <>
              <div
                className="flex w-full overflow-hidden anim-bar"
                style={{ height: 10, borderRadius: 6 }}
              >
                {STATUS_META.filter((s) => (counts[s.id] ?? 0) > 0).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      width: `${((counts[s.id] ?? 0) / totalCount) * 100}%`,
                      background: s.color,
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {STATUS_META.map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      style={{ width: 10, height: 10, borderRadius: 3, background: s.color }}
                    />
                    <span style={{ fontSize: 11, color: "var(--ink-2)" }}>
                      {counts[s.id] ?? 0} {s.label.toLowerCase()}
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Historial de desperdicio */}
        <div className="flex items-center justify-between mt-6 mb-2">
          <h2 className="font-semibold" style={{ fontSize: 13, color: "var(--ink-2)" }}>
            Historial de desperdicio
          </h2>
          {(data?.waste.length ?? 0) > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold active:scale-95 transition-transform"
              style={{
                fontSize: 11,
                background: confirmReset ? "var(--danger)" : "var(--danger-bg)",
                color: confirmReset ? "#fff" : "var(--danger-txt)",
              }}
            >
              <ArrowCounterClockwise size={12} />
              {confirmReset ? "¿Seguro? Toca otra vez" : "Reiniciar"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <CircleNotch size={18} color="var(--ink-3)" className="animate-spin" />
          </div>
        ) : (data?.waste.length ?? 0) === 0 ? (
          <p className="py-4 text-center" style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Nada tirado en este período. ¡Sigue así! 🌿
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.waste.map((w, i) => (
              <div
                key={w.id}
                className="anim-card flex items-center gap-3 p-3.5"
                style={{
                  background: "var(--surface)",
                  borderRadius: 16,
                  boxShadow: "var(--shadow-card)",
                  animationDelay: `${Math.min(i * 40, 280)}ms`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate" style={{ fontSize: 14, color: "var(--ink-1)" }}>
                    {w.product_name}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {w.quantity} und ·{" "}
                    {new Date(w.wasted_at + "Z").toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <span className="font-semibold" style={{ fontSize: 13, color: "var(--danger-txt)" }}>
                  −S/ {(w.price * w.quantity).toFixed(2)}
                </span>
                <button
                  onClick={() => deleteEntry(w.id)}
                  aria-label="Borrar registro"
                  className="flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  style={{
                    width: 26,
                    height: 26,
                    background: "var(--muted-bg)",
                    borderRadius: 8,
                  }}
                >
                  <X size={13} color="var(--muted-txt)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
