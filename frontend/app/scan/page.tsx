"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CircleNotch,
  Image as ImageIcon,
  Microphone,
  Recycle,
  Sparkle,
  Sun,
  ArrowsOutSimple,
} from "@phosphor-icons/react";
import HeaderWave from "@/components/HeaderWave";
import MusicButton from "@/components/MusicButton";
import { api, apiJson } from "@/lib/device";
import { MATERIALS, guessMaterial } from "@/lib/materials";
import type { Material, ScanItem } from "@/lib/types";

type Mode = "idle" | "photo" | "voice";

interface Row extends ScanItem {
  checked: boolean;
}

const STATS_KEY = "qr_scan_stats";

interface Stats {
  scans: number;
  week: number;
  weekStart: string;
  products: number;
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Stats;
      // reinicia el contador semanal cada lunes
      const monday = getMonday();
      if (s.weekStart !== monday) return { ...s, week: 0, weekStart: monday };
      return s;
    }
  } catch {}
  return { scans: 0, week: 0, weekStart: getMonday(), products: 0 };
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

// ---------- Parser de voz ----------

const NUMBER_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, docena: 12,
  media: 1, medio: 1,
};

function detectMaterial(text: string, name: string): Material {
  const t = text.toLowerCase();
  // Específicas ANTES que las genéricas
  if (t.includes("vidrio") || t.includes("frasco")) return "vidrio";
  if (t.includes("lata") || t.includes("tarro")) return "metal";
  if (t.includes("caja") || t.includes("cartón") || t.includes("carton")) return "carton";
  if (t.includes("botella") || t.includes("plástico") || t.includes("plastico") || t.includes("bolsa"))
    return "plastico";
  // El envase no se mencionó: se estima automáticamente, nunca se le pregunta al usuario.
  return guessMaterial(name);
}

function parseTranscript(transcript: string): ScanItem[] {
  const parts = transcript
    .split(/,|\by\b|\btambién\b|\btambien\b|\bluego\b/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: ScanItem[] = [];
  for (const part of parts) {
    let quantity = 1;
    let rest = part;
    const numMatch = part.match(/^(\d+)\s+(.+)$/);
    if (numMatch) {
      quantity = parseInt(numMatch[1], 10);
      rest = numMatch[2];
    } else {
      const wordMatch = part.match(/^(\S+)\s+(.+)$/);
      if (wordMatch && NUMBER_WORDS[wordMatch[1].toLowerCase()] !== undefined) {
        quantity = NUMBER_WORDS[wordMatch[1].toLowerCase()];
        rest = wordMatch[2];
      }
    }
    // limpia palabras de envase del nombre ("botella de", "lata de"…)
    const name = rest
      .replace(/^(botellas?|latas?|frascos?|cajas?|tarros?|bolsas?)\s+(de\s+)?/i, "")
      .trim();
    const material = detectMaterial(rest, name);
    if (name.length >= 2) {
      items.push({ name, quantity: Math.max(1, quantity), price: 0, material, category: "otros" });
    }
  }
  return items;
}

// ---------- Página ----------

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("idle");
  const [stats, setStats] = useState<Stats>({ scans: 0, week: 0, weekStart: "", products: 0 });
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognition = useRef<any>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStats(loadStats());
  }, []);

  function bumpStats(patch: Partial<Pick<Stats, "scans" | "week" | "products">>) {
    setStats((prev) => {
      const next = {
        ...prev,
        scans: prev.scans + (patch.scans ?? 0),
        week: prev.week + (patch.week ?? 0),
        products: prev.products + (patch.products ?? 0),
      };
      localStorage.setItem(STATS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // ----- Foto -----

  function onFileChosen(f: File) {
    setFile(f);
    setRows([]);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api("/scan/receipt", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items: ScanItem[] };
      bumpStats({ scans: 1, week: 1 });
      if (data.items.length === 0) {
        setError("No se reconocieron alimentos en la foto. Intenta con mejor luz.");
      } else {
        setRows(data.items.map((it) => ({ ...it, checked: true })));
      }
    } catch {
      setError("No se pudo analizar la foto. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  }

  // ----- Voz -----

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "es-PE";
    rec.continuous = true;
    rec.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
  }

  function stopVoice() {
    recognition.current?.stop();
    setListening(false);
    if (transcript.trim()) {
      const items = parseTranscript(transcript);
      if (items.length > 0) {
        setRows(items.map((it) => ({ ...it, checked: true })));
        bumpStats({ scans: 1, week: 1 });
      } else {
        setError("No entendí productos en el dictado. Intenta de nuevo.");
      }
    }
  }

  // ----- Guardar -----

  async function save() {
    const chosen = rows.filter((r) => r.checked);
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      await apiJson("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          chosen.map(({ name, quantity, price, material, category }) => ({
            name, quantity, price, material, category,
          }))
        ),
      });
      bumpStats({ products: chosen.length });
      setRows([]);
      setPreview(null);
      setFile(null);
      setTranscript("");
      showToast(`✓ ${chosen.length} producto${chosen.length > 1 ? "s" : ""} guardado${chosen.length > 1 ? "s" : ""}`);
    } catch {
      setError("No se pudieron guardar los productos.");
    } finally {
      setSaving(false);
    }
  }

  const checkedCount = rows.filter((r) => r.checked).length;

  return (
    <main>
      {/* Header variante */}
      <header
        className="sticky top-0 z-40 px-5 pt-12 pb-12"
        style={{ background: "var(--gradient-header)" }}
      >
        <div className="absolute top-12 right-5">
          <MusicButton />
        </div>
        <div className="flex flex-col items-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 68,
              height: 68,
              background: "rgba(255,255,255,0.2)",
              border: "2.5px solid rgba(255,255,255,0.6)",
            }}
          >
            <Camera size={30} color="#fff" weight="duotone" />
          </div>
          <h1
            className="mt-3"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 300,
              fontSize: 32,
              color: "#fff",
              lineHeight: 1.05,
            }}
          >
            Esc<em style={{ color: "rgba(255,255,255,0.75)" }}>anear</em>
          </h1>
          {/* Stats */}
          <div className="flex items-center mt-4 w-full max-w-xs justify-center">
            {[
              { n: stats.scans, label: "Escaneos" },
              { n: stats.week, label: "Esta semana" },
              { n: stats.products, label: "Productos" },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center">
                {i > 0 && (
                  <div
                    aria-hidden
                    style={{ width: 1, height: 28, background: "rgba(255,255,255,0.25)" }}
                    className="mx-5"
                  />
                )}
                <div className="text-center">
                  <p style={{ fontSize: 20, fontWeight: 600, color: "#fff", lineHeight: 1 }}>
                    {s.n}
                  </p>
                  <p
                    className="uppercase mt-1"
                    style={{ fontSize: 9, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}
                  >
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <HeaderWave />
      </header>

      <div className="px-5 pt-4">
        {/* Cards de modo */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setMode("photo");
              setRows([]);
              setError(null);
            }}
            className="anim-card flex items-center gap-4 p-5 text-left active:scale-[0.98] transition-transform"
            style={{
              background: "var(--surface)",
              borderRadius: 20,
              boxShadow: "var(--shadow-card)",
              border: mode === "photo" ? "2px solid var(--violet)" : "2px solid transparent",
            }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 52, height: 52, background: "var(--violet-bg)", borderRadius: 16 }}
            >
              <Camera size={26} color="var(--violet)" weight="duotone" />
            </div>
            <div>
              <p className="font-semibold" style={{ fontSize: 15, color: "var(--ink-1)" }}>
                Foto o ticket de compra
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-3)" }}>
                La IA identifica tus alimentos y envases
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setMode("voice");
              setRows([]);
              setError(null);
            }}
            className="anim-card flex items-center gap-4 p-5 text-left active:scale-[0.98] transition-transform"
            style={{
              background: "var(--surface)",
              borderRadius: 20,
              boxShadow: "var(--shadow-card)",
              border: mode === "voice" ? "2px solid var(--brand-mid)" : "2px solid transparent",
              animationDelay: "60ms",
            }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 52, height: 52, background: "var(--brand-bg)", borderRadius: 16 }}
            >
              <Microphone size={26} color="var(--brand-mid)" weight="duotone" />
            </div>
            <div>
              <p className="font-semibold" style={{ fontSize: 15, color: "var(--ink-1)" }}>
                Dictado por voz
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-3)" }}>
                &ldquo;Dos litros de leche, una lata de atún…&rdquo;
              </p>
            </div>
          </button>
        </div>

        {/* Tips */}
        <div className="flex gap-2 mt-3 anim-bar" style={{ animationDelay: "120ms" }}>
          {[
            { Icon: Sun, label: "Buena luz" },
            { Icon: ArrowsOutSimple, label: "Sin dobleces" },
            { Icon: Sparkle, label: "Completo" },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ fontSize: 10, background: "var(--muted-bg)", color: "var(--muted-txt)" }}
            >
              <Icon size={11} /> {label}
            </span>
          ))}
        </div>

        {/* ----- Modo foto ----- */}
        {mode === "photo" && (
          <div className="mt-4 anim-scale">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileChosen(f);
              }}
            />
            {!preview ? (
              <button
                onClick={() => fileInput.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 active:scale-[0.99] transition-transform"
                style={{
                  height: 200,
                  border: "2px dashed var(--border)",
                  borderRadius: 20,
                  background: "var(--surface)",
                }}
              >
                <ImageIcon size={34} color="var(--ink-3)" weight="duotone" />
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  Toca para tomar o elegir una foto
                </span>
              </button>
            ) : (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Vista previa"
                  className="w-full object-cover"
                  style={{ maxHeight: 260, borderRadius: 20, boxShadow: "var(--shadow-card)" }}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setPreview(null);
                      setFile(null);
                      setRows([]);
                    }}
                    className="rounded-full px-4 py-2.5 font-semibold active:scale-95 transition-transform"
                    style={{ fontSize: 13, background: "var(--muted-bg)", color: "var(--muted-txt)" }}
                  >
                    Cambiar
                  </button>
                  <button
                    onClick={analyze}
                    disabled={analyzing}
                    className="flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-70"
                    style={{
                      fontSize: 14,
                      background: "linear-gradient(135deg, var(--violet) 0%, #5b2da8 100%)",
                    }}
                  >
                    {analyzing ? (
                      <>
                        <CircleNotch size={16} className="animate-spin" /> Analizando…
                      </>
                    ) : (
                      <>
                        <Sparkle size={16} weight="fill" /> Analizar foto
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----- Modo voz ----- */}
        {mode === "voice" && (
          <div className="mt-6 flex flex-col items-center anim-scale">
            {!voiceSupported ? (
              <p style={{ fontSize: 13, color: "var(--danger-txt)" }} className="text-center">
                Tu navegador no soporta dictado por voz. Prueba con Chrome.
              </p>
            ) : (
              <>
                <button
                  onClick={listening ? stopVoice : startVoice}
                  className="flex items-center justify-center rounded-full active:scale-95 transition-all"
                  style={{
                    width: 100,
                    height: 100,
                    background: listening ? "var(--violet)" : "var(--surface)",
                    boxShadow: listening
                      ? "0 0 0 14px rgba(91,45,168,0.12)"
                      : "var(--shadow-card)",
                  }}
                >
                  <Microphone
                    size={40}
                    color={listening ? "#fff" : "var(--violet)"}
                    weight={listening ? "fill" : "duotone"}
                  />
                </button>
                <p className="mt-3" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {listening ? "Escuchando… toca para terminar" : "Toca para dictar"}
                </p>
                {transcript && (
                  <p
                    className="mt-3 text-center px-4 py-3 w-full"
                    style={{
                      fontSize: 13,
                      color: "var(--ink-2)",
                      background: "var(--surface)",
                      borderRadius: 14,
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    “{transcript}”
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p
            className="mt-4 px-4 py-3 anim-bar"
            style={{
              fontSize: 13,
              background: "var(--danger-bg)",
              color: "var(--danger-txt)",
              borderRadius: 14,
            }}
          >
            {error}
          </p>
        )}

        {/* ----- Resultados ----- */}
        {rows.length > 0 && (
          <div className="mt-5">
            <p className="font-semibold mb-2" style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Productos detectados — toca para marcar o desmarcar
            </p>
            <div className="flex flex-col gap-2">
              {rows.map((row, i) => {
                const mat = MATERIALS[row.material] ?? MATERIALS.desconocido;
                return (
                  <div
                    key={`${row.name}-${i}`}
                    className="anim-card flex items-center gap-3 p-3.5 cursor-pointer"
                    style={{
                      background: "var(--surface)",
                      borderRadius: 16,
                      boxShadow: "var(--shadow-card)",
                      border: row.checked ? "2px solid var(--violet)" : "2px solid transparent",
                      opacity: row.checked ? 1 : 0.55,
                      animationDelay: `${Math.min(i * 40, 280)}ms`,
                    }}
                    onClick={() =>
                      setRows((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, checked: !r.checked } : r))
                      )
                    }
                  >
                    <div
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{
                        width: 22,
                        height: 22,
                        border: `2px solid ${row.checked ? "var(--violet)" : "var(--border)"}`,
                        background: row.checked ? "var(--violet)" : "transparent",
                      }}
                    >
                      {row.checked && <Check size={12} color="#fff" weight="bold" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ fontSize: 14, color: "var(--ink-1)" }}>
                        {row.name}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        {row.quantity} und · {mat.label}
                        {row.price > 0 && ` · S/ ${row.price.toFixed(2)}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showToast(mat.tip);
                      }}
                      aria-label="Tip de reciclaje"
                      className="flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                      style={{
                        width: 30,
                        height: 30,
                        background: "var(--brand-bg)",
                        borderRadius: 10,
                      }}
                    >
                      <Recycle size={16} color="var(--brand-mid)" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={save}
              disabled={saving || checkedCount === 0}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ fontSize: 14, background: "var(--brand)" }}
            >
              {saving ? (
                <>
                  <CircleNotch size={16} className="animate-spin" /> Guardando…
                </>
              ) : (
                `Guardar ${checkedCount} producto${checkedCount === 1 ? "" : "s"}`
              )}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 px-4 py-3 anim-scale"
          style={{
            background: "#1a1714",
            color: "#fff",
            fontSize: 13,
            borderRadius: 14,
            maxWidth: "85%",
            boxShadow: "var(--shadow-nav)",
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
