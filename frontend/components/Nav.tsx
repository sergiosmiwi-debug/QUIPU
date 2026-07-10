"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Basket, ChartLineUp, PencilSimpleLine, Recycle } from "@phosphor-icons/react";

const TABS = [
  { href: "/", label: "Despensa", Icon: Basket },
  { href: "/anotar", label: "Anotar", Icon: PencilSimpleLine },
  { href: "/reciclar", label: "Reciclar", Icon: Recycle },
  { href: "/huella", label: "Huella", Icon: ChartLineUp },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md"
      style={{
        zIndex: "var(--z-nav)",
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 pt-2.5 pb-2 relative"
            >
              {/* nudo indicador de pestaña activa */}
              <span
                aria-hidden
                className="absolute top-0 rounded-full transition-all duration-300"
                style={{
                  width: active ? 20 : 0,
                  height: 3,
                  background: "var(--qantu)",
                  transitionTimingFunction: "var(--ease-out)",
                }}
              />
              <Icon
                size={23}
                weight={active ? "fill" : "regular"}
                color={active ? "var(--chicha)" : "var(--ink-faint)"}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--chicha)" : "var(--ink-faint)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
