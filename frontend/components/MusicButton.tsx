"use client";

import { useEffect, useState } from "react";
import { SpeakerSimpleHigh, SpeakerSimpleSlash } from "@phosphor-icons/react";
import { isAvailable, isPlaying, toggleAmbient } from "@/lib/ambient";

export default function MusicButton() {
  const [available, setAvailable] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const sync = () => {
      setAvailable(isAvailable());
      setPlaying(isPlaying());
    };
    sync();
    window.addEventListener("ambient-ready", sync);
    window.addEventListener("ambient-change", sync);
    return () => {
      window.removeEventListener("ambient-ready", sync);
      window.removeEventListener("ambient-change", sync);
    };
  }, []);

  if (!available) return null;

  return (
    <button
      onClick={() => toggleAmbient()}
      aria-label={playing ? "Silenciar música" : "Activar música"}
      className="flex items-center justify-center active:scale-[0.95] transition-transform"
      style={{
        width: 34,
        height: 34,
        background: "rgba(255,255,255,0.15)",
        borderRadius: 10,
      }}
    >
      {playing ? (
        <SpeakerSimpleHigh size={15} color="#fff" weight="fill" />
      ) : (
        <SpeakerSimpleSlash size={15} color="#fff" />
      )}
    </button>
  );
}
