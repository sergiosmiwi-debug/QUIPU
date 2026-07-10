"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowClockwise,
  Bell,
  BellSlash,
  CheckSquare,
  Leaf,
} from "@phosphor-icons/react";
import HeaderButton from "@/components/HeaderButton";
import HeaderWave from "@/components/HeaderWave";
import MusicButton from "@/components/MusicButton";
import ProductCard from "@/components/ProductCard";
import { apiJson } from "@/lib/device";
import { BIN_COLORS } from "@/lib/materials";
import type { Product } from "@/lib/types";

type Filter = "todos" | "urgente" | "pronto" | "frescos" | "vencidos";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "urgente", label: "Urgente" },
  { id: "pronto", label: "Pronto" },
  { id: "frescos", label: "Frescos" },
  { id: "vencidos", label: "Vencidos" },
];

const LEGEND = [
  { color: BIN_COLORS.verde, label: "Bolsa verde · reciclables" },
  { color: BIN_COLORS.caja, label: "Caja · cartón/papel" },
  { color: BIN_COLORS.negra, label: "Bolsa negra · generales" },
  { color: BIN_COLORS.desconocido, label: "Sin identificar" },
];

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Filter>("todos");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [notifOn, setNotifOn] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await apiJson<Product[]>("/products"));
    } catch {
      // backend caído: mantenemos la lista actual
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setNotifOn(typeof Notification !== "undefined" && Notification.permission === "granted");
  }, []);

  const urgentCount = products.filter(
    (p) => p.status === "danger" || p.status === "expired"
  ).length;

  const filtered = products.filter((p) => {
    switch (filter) {
      case "urgente":
        return p.status === "danger";
      case "pronto":
        return p.status === "warning";
      case "frescos":
        return p.status === "fresh";
      case "vencidos":
        return p.status === "expired";
      default:
        return true;
    }
  });

  function removeWithAnim(id: number, action: () => Promise<unknown>) {
    setRemoving((prev) => new Set(prev).add(id));
    action().catch(() => {});
    setTimeout(() => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 340);
  }

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifOn(true);
      const soon = products.filter((p) => p.days_left >= 0 && p.days_left <= 3);
      if (soon.length > 0) {
        new Notification("QuipuRecicla", {
          body: `Tienes ${soon.length} producto${soon.length > 1 ? "s" : ""} por vencer: ${soon
            .slice(0, 3)
            .map((p) => p.name)
            .join(", ")}`,
        });
      } else {
        new Notification("QuipuRecicla", { body: "Todo fresco por ahora 🌿" });
      }
    }
  }

  async function handleOpen(id: number) {
    try {
      const updated = await apiJson<Product>(`/products/${id}/open`, { method: "POST" });
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch {}
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function wasteSelected() {
    for (const id of selected) {
      removeWithAnim(id, () => apiJson(`/products/${id}`, { method: "DELETE" }));
    }
    setSelected(new Set());
    setSelectMode(false);
  }

  function clearAll() {
    for (const p of products) {
      removeWithAnim(p.id, () => apiJson(`/products/${p.id}/consume`, { method: "POST" }));
    }
    setSelected(new Set());
    setSelectMode(false);
  }

  return (
    <main>
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-5 pt-12 pb-12"
        style={{ background: "var(--gradient-header)", position: "sticky" }}
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
              Quipu
              <em style={{ color: "rgba(255,255,255,0.75)" }}>Recicla</em>
            </h1>
            <p
              className="uppercase mt-1"
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.06em",
              }}
            >
              {products.length} productos · {urgentCount} urgentes
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <MusicButton />
            <HeaderButton onClick={requestNotifications} label="Notificaciones" active={notifOn}>
              {notifOn ? (
                <Bell size={15} color="#fff" weight="fill" />
              ) : (
                <BellSlash size={15} color="#fff" />
              )}
            </HeaderButton>
            <HeaderButton
              onClick={() => {
                setSelectMode((v) => !v);
                setSelected(new Set());
              }}
              label="Selección múltiple"
              active={selectMode}
            >
              <CheckSquare size={15} color="#fff" />
            </HeaderButton>
            <HeaderButton onClick={load} label="Recargar">
              <ArrowClockwise size={15} color="#fff" />
            </HeaderButton>
          </div>
        </div>

        {/* Pills de filtro */}
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="rounded-full px-3 py-1.5 font-semibold whitespace-nowrap active:scale-95 transition-transform"
                style={{
                  fontSize: 12,
                  background: active ? "#fff" : "rgba(255,255,255,0.13)",
                  color: active ? "var(--brand)" : "rgba(255,255,255,0.85)",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <HeaderWave />
      </header>

      {/* Leyenda de colores */}
      <div className="px-5 pt-3 pb-4 flex flex-wrap gap-x-4 gap-y-1.5 anim-bar">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              style={{ width: 10, height: 10, borderRadius: 3, background: l.color }}
            />
            <span style={{ fontSize: 10, color: "var(--ink-2)" }}>{l.label}</span>
          </span>
        ))}
      </div>

      {/* Lista de productos */}
      <div className="px-5">
        {filtered.length === 0 && !loading ? (
          <div className="flex flex-col items-center pt-16 anim-scale">
            <div
              className="flex items-center justify-center"
              style={{
                width: 60,
                height: 60,
                background: "var(--brand-bg)",
                borderRadius: 18,
              }}
            >
              <Leaf size={28} color="var(--brand-mid)" weight="duotone" />
            </div>
            <p
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                fontSize: 24,
                color: "var(--ink-1)",
              }}
            >
              Nada por <em style={{ color: "var(--violet)" }}>aquí</em>
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-3)" }} className="mt-1">
              Escanea un ticket o foto de tu refri
            </p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              index={i}
              selectMode={selectMode}
              selected={selected.has(p.id)}
              onToggleSelect={() => toggleSelect(p.id)}
              removing={removing.has(p.id)}
              onOpen={() => handleOpen(p.id)}
              onConsume={() =>
                removeWithAnim(p.id, () =>
                  apiJson(`/products/${p.id}/consume`, { method: "POST" })
                )
              }
              onWaste={() =>
                removeWithAnim(p.id, () => apiJson(`/products/${p.id}`, { method: "DELETE" }))
              }
              onDismiss={() =>
                removeWithAnim(p.id, () =>
                  apiJson(`/products/${p.id}/consume`, { method: "POST" })
                )
              }
            />
          ))
        )}
      </div>

      {/* Barra flotante en modo selección */}
      {selectMode && (
        <div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 flex gap-2 rounded-full px-3 py-2 anim-scale"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-nav)" }}
        >
          <button
            onClick={clearAll}
            className="rounded-full px-4 py-2 font-semibold active:scale-95 transition-transform"
            style={{ fontSize: 12, background: "var(--muted-bg)", color: "var(--muted-txt)" }}
          >
            Limpiar todo
          </button>
          <button
            onClick={wasteSelected}
            disabled={selected.size === 0}
            className="rounded-full px-4 py-2 font-semibold active:scale-95 transition-transform disabled:opacity-40"
            style={{ fontSize: 12, background: "var(--danger)", color: "#fff" }}
          >
            Tirar {selected.size} seleccionados
          </button>
        </div>
      )}
    </main>
  );
}
