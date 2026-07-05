"use client";

// Singleton de módulo: el <audio> sobrevive la navegación entre páginas.
// Silenciar = volumen 0 — nunca pausar ni recrear, así jamás se reinicia.

let audio: HTMLAudioElement | null = null;
let available = false;
let initialized = false;

const VOLUME = 0.08;

export function isAvailable() {
  return available;
}

export function isPlaying() {
  return !!audio && !audio.paused && audio.volume > 0;
}

function emit(name: string) {
  window.dispatchEvent(new CustomEvent(name, { detail: { playing: isPlaying(), available } }));
}

export async function initAmbient() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const head = await fetch("/ambient.mp3", { method: "HEAD" });
    if (!head.ok) return;
  } catch {
    return;
  }
  audio = new Audio("/ambient.mp3");
  audio.loop = true;
  audio.volume = VOLUME;
  available = true;
  emit("ambient-ready");
}

export async function toggleAmbient(): Promise<boolean> {
  if (!audio) return false;
  if (isPlaying()) {
    audio.volume = 0;
  } else {
    audio.volume = VOLUME;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        // Autoplay bloqueado hasta la primera interacción; el botón es una interacción.
      }
    }
  }
  emit("ambient-change");
  return isPlaying();
}
