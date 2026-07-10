"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CaretDown, CircleNotch, PencilSimpleLine } from "@phosphor-icons/react";
import { Knot, QuipuEmpty, QuipuMark } from "@/components/Quipu";
import { MATERIALS, bagFor } from "@/lib/materials";
import { apiJson } from "@/lib/device";
import type { Product, Status } from "@/lib/types";

/* Secciones del quipu: cada grupo de urgencia es una cuerda. */
const SECTIONS: { id: Status; title: string; color: string; tint: string; ink: string }[] = [
  { id: "expired", title: "Ya se pasó", color: "var(--vencido)", tint: "var(--vencido-tint)", ink: "var(--ink-soft)" },
  { id: "danger", title: "Hoy o mañana", color: "var(--urgente)", tint: "var(--urgente-tint)", ink: "var(--urgente-ink)" },
  { id: "warning", title: "Esta semana", color: "var(--pronto)", tint: "var(--pronto-tint)", ink: "var(--pronto-ink)" },
  { id: "fresh", title: "Tranquilo", color: "var(--fresco)", tint: "var(--fresco-tint)", ink: "var(--fresco-ink)" },
];

function daysLabel(p: Product): string {
  if (p.days_left < 0) {
    const d = -p.days_left;
    return d === 1 ? "hace 1 día" : `hace ${d} días`;
  }
  if (p.days_left === 0) return "vence hoy";
  if (p.days_left === 1) return "vence mañana";
  if (p.days_left >= 720) return `${Math.round(p.days_left / 365)} años`;
  if (p.days_left >= 330) return "1 año";
  if (p.days_left >= 60) return `${Math.round(p.days_left / 30)} meses`;
  return `${p.days_left} días`;
}

export default function DespensaPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; bag?: { name: string; color: string } } | null>(null);

  const load = useCallback(async () => {
    try {
      setProducts(await apiJson<Product[]>("/products"));
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function showToast(msg: string, bag?: { name: string; color: string }) {
    setToast({ msg, bag });
    setTimeout(() => setToast(null), 4200);
  }

  async function act(p: Product, action: "open" | "consume" | "waste") {
    setBusy(p.id);
    try {
      if (action === "open") {
        const updated = await apiJson<Product>(`/products/${p.id}/open`, { method: "POST" });
        setProducts((prev) => prev!.map((x) => (x.id === p.id ? updated : x)));
        showToast(`Abierto: te quedan ${daysLabel(updated).replace("vence ", "")}`);
      } else {
        const path = action === "consume" ? `/products/${p.id}/consume` : `/products/${p.id}`;
        await apiJson(path, { method: action === "consume" ? "POST" : "DELETE" });
        setProducts((prev) => prev!.filter((x) => x.id !== p.id));
        const bag = bagFor(p.material);
        const hasBag = MATERIALS[p.material]?.bag !== "desconocido";
        showToast(
          action === "consume" ? "Buen provecho. El envase va en:" : "Anotado en tu huella. El envase va en:",
          hasBag ? { name: bag.name, color: bag.color } : undefined
        );
      }
    } catch {
      showToast("No se pudo guardar. Revisa tu conexión.");
    } finally {
      setBusy(null);
      setOpenId(null);
    }
  }

  const atRisk = useMemo(() => {
    if (!products) return 0;
    return products
      .filter((p) => p.status === "danger" || p.status === "warning")
      .reduce((sum, p) => sum + p.price * p.quantity, 0);
  }, [products]);

  const grouped = useMemo(() => {
    if (!products) return [];
    return SECTIONS.map((s) => ({
      ...s,
      items: products.filter((p) => p.status === s.id),
    })).filter((s) => s.items.length > 0);
  }, [products]);

  return (
    <main>
      {/* Cabecera chicha */}
      <header className="px-5 pt-10 pb-7" style={{ background: "var(--chicha)", color: "#fff" }}>
        <QuipuMark width={120} tone="light" />
        <h1 className="mt-4" style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.12 }}>
          El quipu de tu casa
        </h1>
        <p className="mt-1.5" style={{ fontSize: 14.5, color: "oklch(0.88 0.03 315)" }}>
          {products === null
            ? "Desatando los nudos…"
            : products.length === 0
              ? "Todavía no hay nudos. Anota tu primera compra."
              : atRisk > 0
                ? `S/ ${atRisk.toFixed(2)} en riesgo si no los usas a tiempo.`
                : `${products.length} producto${products.length === 1 ? "" : "s"} anudado${products.length === 1 ? "" : "s"}, ninguno en peligro.`}
        </p>
      </header>

      {/* Cuerdas por urgencia */}
      <div className="px-5 pt-5 pb-4">
        {products === null ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: "var(--ink-faint)" }}>
            <CircleNotch size={18} className="animate-spin" />
            <span style={{ fontSize: 14 }}>Cargando tu despensa…</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center pt-12 pb-6 text-center">
            <QuipuEmpty />
            <p className="mt-5" style={{ fontSize: 15, color: "var(--ink-soft)", maxWidth: 260 }}>
              Un quipu sin nudos no cuenta nada. Toma una foto de tu ticket o dicta lo que compraste.
            </p>
            <Link
              href="/anotar"
              className="mt-5 flex items-center gap-2 rounded-full px-6 py-3.5 font-semibold active:scale-[0.97] transition-transform"
              style={{ background: "var(--chicha)", color: "#fff", fontSize: 15 }}
            >
              <PencilSimpleLine size={18} weight="bold" /> Anotar mi primera compra
            </Link>
          </div>
        ) : (
          grouped.map((section, si) => (
            <section key={section.id} className="anim-rise" style={{ animationDelay: `${si * 70}ms` }}>
              <h2
                className="flex items-center gap-2 mt-4 mb-1"
                style={{ fontFamily: "var(--font-display)", fontSize: 17, color: section.ink }}
              >
                <Knot color={section.color} size={16} />
                {section.title}
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-faint)" }}>
                  · {section.items.length}
                </span>
              </h2>

              {/* la cuerda: hilo vertical continuo con un nudo por producto */}
              <ul className="relative ml-[7px] pl-6" style={{ borderLeft: `2px solid ${section.color}` }}>
                {section.items.map((p, i) => {
                  const expanded = openId === p.id;
                  const mat = MATERIALS[p.material] ?? MATERIALS.desconocido;
                  const bag = bagFor(p.material);
                  return (
                    <li key={p.id} className="relative anim-knot" style={{ animationDelay: `${si * 70 + i * 45}ms` }}>
                      {/* nudo sobre la cuerda */}
                      <span aria-hidden className="absolute" style={{ left: -33, top: 16 }}>
                        <Knot color={section.color} size={18} />
                      </span>

                      <button
                        onClick={() => setOpenId(expanded ? null : p.id)}
                        aria-expanded={expanded}
                        className="w-full text-left py-3 flex items-center gap-3"
                        style={{ borderBottom: expanded ? "none" : "1px solid var(--line-soft)" }}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block truncate" style={{ fontSize: 15.5, fontWeight: 600 }}>
                            {p.name}
                            {p.quantity > 1 && (
                              <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}> ×{p.quantity}</span>
                            )}
                          </span>
                          <span className="block mt-0.5" style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                            {p.opened_date ? "abierto · " : ""}
                            S/ {(p.price * p.quantity).toFixed(2)} · {mat.label}
                          </span>
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 shrink-0 font-semibold"
                          style={{ fontSize: 12, background: section.tint, color: section.ink }}
                        >
                          {daysLabel(p)}
                        </span>
                        <CaretDown
                          size={14}
                          color="var(--ink-faint)"
                          className="shrink-0 transition-transform duration-300"
                          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
                        />
                      </button>

                      {expanded && (
                        <div className="anim-fade pb-4" style={{ borderBottom: "1px solid var(--line-soft)" }}>
                          {/* a qué bolsa va el envase */}
                          <p
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-3"
                            style={{ fontSize: 12.5, background: bag.tint, color: "var(--ink)" }}
                          >
                            <span
                              aria-hidden
                              className="rounded-full inline-block"
                              style={{ width: 9, height: 9, background: bag.color }}
                            />
                            {MATERIALS[p.material]?.bag === "desconocido"
                              ? "Envase sin confirmar"
                              : `El envase va en: ${bag.short}`}
                          </p>
                          <div className="flex gap-2">
                            {!p.opened_date && p.changes_on_open && (
                              <button
                                onClick={() => act(p, "open")}
                                disabled={busy === p.id}
                                className="flex-1 rounded-full py-2.5 font-semibold active:scale-[0.97] transition-transform disabled:opacity-60"
                                style={{ fontSize: 13.5, border: "1.5px solid var(--line)", color: "var(--ink-soft)", background: "var(--surface)" }}
                              >
                                Lo abrí
                              </button>
                            )}
                            <button
                              onClick={() => act(p, "consume")}
                              disabled={busy === p.id}
                              className="flex-1 rounded-full py-2.5 font-semibold active:scale-[0.97] transition-transform disabled:opacity-60"
                              style={{ fontSize: 13.5, background: "var(--fresco-tint)", color: "var(--fresco-ink)" }}
                            >
                              Lo usé
                            </button>
                            <button
                              onClick={() => act(p, "waste")}
                              disabled={busy === p.id}
                              className="flex-1 rounded-full py-2.5 font-semibold active:scale-[0.97] transition-transform disabled:opacity-60"
                              style={{ fontSize: 13.5, background: "var(--urgente-tint)", color: "var(--urgente-ink)" }}
                            >
                              Se pasó
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Toast con la bolsa correspondiente */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 anim-knot px-4 py-3 rounded-2xl w-[calc(100%-40px)] max-w-sm"
          style={{ zIndex: "var(--z-toast)", background: "var(--ink)", color: "#fff", boxShadow: "var(--shadow-2)" }}
        >
          <p style={{ fontSize: 13.5 }}>{toast.msg}</p>
          {toast.bag && (
            <p
              className="inline-flex items-center gap-2 mt-1.5 rounded-full px-2.5 py-1 font-semibold"
              style={{ fontSize: 12.5, background: "oklch(1 0 0 / 0.14)" }}
            >
              <span aria-hidden className="rounded-full inline-block" style={{ width: 9, height: 9, background: toast.bag.color }} />
              {toast.bag.name}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
