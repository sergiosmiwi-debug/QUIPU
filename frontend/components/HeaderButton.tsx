"use client";

import type { ReactNode } from "react";

export default function HeaderButton({
  onClick,
  label,
  children,
  active,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center active:scale-[0.95] transition-transform"
      style={{
        width: 34,
        height: 34,
        background: active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)",
        borderRadius: 10,
      }}
    >
      {children}
    </button>
  );
}
