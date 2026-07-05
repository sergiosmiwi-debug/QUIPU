"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, MapPin, Package, Scan } from "@phosphor-icons/react";

const TABS = [
  { href: "/", label: "INVENTARIO", Icon: Package },
  { href: "/scan", label: "ESCANEAR", Icon: Scan },
  { href: "/ecopuntos", label: "ECOPUNTOS", Icon: MapPin },
  { href: "/dashboard", label: "RESUMEN", Icon: ChartBar },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full px-2 py-2"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-nav)" }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 transition-colors"
            style={active ? { background: "var(--brand)" } : undefined}
          >
            <Icon
              size={18}
              weight={active ? "fill" : "regular"}
              color={active ? "#fff" : "var(--ink-3)"}
            />
            <span
              className="uppercase font-semibold"
              style={{
                fontSize: 9,
                letterSpacing: "0.05em",
                color: active ? "#fff" : "var(--ink-3)",
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
