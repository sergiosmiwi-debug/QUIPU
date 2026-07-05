"use client";

import { useEffect } from "react";
import { initAmbient } from "@/lib/ambient";

/** Renderiza null; solo inicializa el singleton de audio una vez desde el root layout. */
export default function AmbientPlayer() {
  useEffect(() => {
    initAmbient();
  }, []);
  return null;
}
