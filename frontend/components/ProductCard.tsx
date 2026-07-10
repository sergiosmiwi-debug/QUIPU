"use client";

import { useState } from "react";
import { Check, Lock, Trash, X } from "@phosphor-icons/react";
import { MATERIALS } from "@/lib/materials";
import type { Product } from "@/lib/types";

const STATUS_COLORS: Record<string, { fg: string; bg: string; txt: string; label: string }> = {
  fresh: { fg: "var(--fresh)", bg: "var(--fresh-bg)", txt: "var(--fresh-txt)", label: "Fresco" },
  warning: { fg: "var(--warn)", bg: "var(--warn-bg)", txt: "var(--warn-txt)", label: "Por vencer" },
  danger: { fg: "var(--danger)", bg: "var(--danger-bg)", txt: "var(--danger-txt)", label: "Urgente" },
  expired: { fg: "var(--muted)", bg: "var(--muted-bg)", txt: "var(--muted-txt)", label: "Vencido" },
};

export default function ProductCard({
  product,
  onOpen,
  onConsume,
  onWaste,
  onDismiss,
  selectMode,
  selected,
  onToggleSelect,
  removing,
  index,
}: {
  product: Product;
  onOpen: () => void;
  onConsume: () => void;
  onWaste: () => void;
  onDismiss: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  removing: boolean;
  index: number;
}) {
  const [confirmWaste, setConfirmWaste] = useState(false);
  const status = STATUS_COLORS[product.status] ?? STATUS_COLORS.fresh;
  const mat = MATERIALS[product.material] ?? MATERIALS.desconocido;
  const sealed =
    product.changes_on_open && !product.opened_date && product.material !== "organico";
  const opened = !!product.opened_date;
  const daysAbs = Math.abs(product.days_left);
  const unit =
    product.days_left < 0 ? "VENCIDO" : product.days_left === 0 ? "HOY" : "DÍAS";
  const bigNumber = product.days_left === 0 ? "0" : String(daysAbs);

  return (
    <div
      className="grid transition-all"
      style={{
        gridTemplateRows: removing ? "0fr" : "1fr",
        opacity: removing ? 0 : 1,
        transform: removing ? "translateX(16px)" : "none",
        transitionDuration: "340ms",
        transitionTimingFunction: "var(--ease-out)",
      }}
    >
      <div className="overflow-hidden min-h-0">
        <div
          className="anim-card relative mb-3"
          style={{
            background: "var(--surface)",
            borderRadius: 20,
            boxShadow: "var(--shadow-card)",
            animationDelay: `${Math.min(index * 40, 320)}ms`,
          }}
          onClick={selectMode ? onToggleSelect : undefined}
        >
          {/* Triángulo del color del tacho */}
          <div
            aria-hidden
            className="absolute top-0 right-0"
            style={{
              width: 72,
              height: 72,
              clipPath: "polygon(100% 0, 100% 100%, 0 0)",
              background: mat.binColor,
              opacity: 0.88,
              borderRadius: "0 20px 0 0",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          {/* Botón X: sacar sin registrar desperdicio */}
          {!selectMode && (
            <button
              onClick={onDismiss}
              aria-label="Quitar sin registrar"
              className="absolute flex items-center justify-center active:scale-90"
              style={{ top: 6, right: 6, width: 24, height: 24, zIndex: 2 }}
            >
              <X size={13} color="rgba(255,255,255,0.9)" weight="bold" />
            </button>
          )}

          <div className="flex p-4 pb-3 gap-3">
            {/* Checkbox en modo selección */}
            {selectMode && (
              <div className="flex items-center" style={{ zIndex: 2 }}>
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 22,
                    height: 22,
                    border: `2px solid ${selected ? "var(--brand-mid)" : "var(--border)"}`,
                    background: selected ? "var(--brand-mid)" : "transparent",
                  }}
                >
                  {selected && <Check size={12} color="#fff" weight="bold" />}
                </div>
              </div>
            )}

            {/* Columna de días */}
            <div
              className="flex flex-col items-center justify-center pr-3"
              style={{ minWidth: 52, borderRight: "1px solid var(--border-lo)" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 36,
                  fontWeight: 300,
                  lineHeight: 1,
                  color: status.fg,
                }}
              >
                {bigNumber}
              </span>
              <span
                className="uppercase"
                style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--ink-3)" }}
              >
                {unit}
              </span>
              {sealed && (
                <span
                  style={{
                    fontSize: 9,
                    color: "var(--ink-3)",
                    textDecoration: "line-through",
                    marginTop: 2,
                  }}
                >
                  {product.shelf_opened} días abierto
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p
                className="font-semibold truncate"
                style={{ fontSize: 15, color: "var(--ink-1)", paddingRight: 36 }}
              >
                {product.name}
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {product.quantity} und · {product.category}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="font-bold rounded-full px-2 py-0.5"
                  style={{ fontSize: 10, background: status.bg, color: status.txt }}
                >
                  {status.label}
                </span>
                {opened && (
                  <span style={{ fontSize: 10, color: "var(--ink-3)" }}>· abierto</span>
                )}
              </div>
              {/* Fila de material */}
              <div className="flex items-center gap-1.5 mt-2">
                <span
                  aria-hidden
                  className="rounded-full"
                  style={{ width: 8, height: 8, background: mat.binColor }}
                />
                <span style={{ fontSize: 10, color: "var(--ink-2)" }}>
                  {mat.binName}{" "}
                  <span style={{ color: "var(--ink-3)" }}>al tirar</span>
                </span>
              </div>
            </div>
          </div>

          {/* Fila de acciones */}
          {!selectMode && (
            <div className="px-4 pb-4">
              {sealed ? (
                <>
                  <button
                    onClick={onOpen}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold active:scale-[0.98] transition-transform"
                    style={{
                      background: "linear-gradient(135deg,#e8e8ef,#d4d4de)",
                      border: "1px solid #c8c8d4",
                      color: "#4a4a55",
                      fontSize: 13,
                    }}
                  >
                    <Lock size={14} weight="fill" />
                    No abierto
                  </button>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => (confirmWaste ? onWaste() : setConfirmWaste(true))}
                      className="rounded-full px-3 py-1 font-semibold active:scale-95 transition-transform"
                      style={{
                        fontSize: 11,
                        background: "var(--danger-bg)",
                        color: "var(--danger-txt)",
                      }}
                    >
                      {confirmWaste ? "¿Confirmar?" : "Tirar"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={onConsume}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold active:scale-95 transition-transform"
                    style={{
                      fontSize: 12,
                      background: "var(--fresh-bg)",
                      color: "var(--fresh-txt)",
                    }}
                  >
                    <Check size={13} weight="bold" /> Consumido
                  </button>
                  <button
                    onClick={() => (confirmWaste ? onWaste() : setConfirmWaste(true))}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold active:scale-95 transition-transform"
                    style={{
                      fontSize: 12,
                      background: "var(--danger-bg)",
                      color: "var(--danger-txt)",
                    }}
                  >
                    <Trash size={13} /> {confirmWaste ? "¿Confirmar?" : "Tirar"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
