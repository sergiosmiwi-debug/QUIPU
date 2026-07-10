"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  CircleNotch,
  Microphone,
  Minus,
  PencilSimpleLine,
  Plus,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { api, apiJson } from "@/lib/device";
import { MATERIALS, bagFor, guessMaterial } from "@/lib/materials";
import type { Material, ScanItem } from "@/lib/types";

type Mode = "foto" | "voz" | "mano";

interface Row extends ScanItem {
  checked: boolean;
}

/* ---------- Parser de dictado ---------- */

const NUMBER_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, docena: 12,
  media: 1, medio: 1,
};

function detectMaterial(text: string, name: string): Material {
  const t = text.toLowerCase();
  if (t.includes("vidrio") || t.includes("frasco")) return "vidrio";
  if (t.includes("lata") || t.includes("tarro")) return "metal";
  if (t.includes("caja") || t.includes("cartón") || t.includes("carton")) return "carton";
  if (t.includes("botella") || t.includes("plástico") || t.includes("plastico") || t.includes("bolsa"))
    return "plastico";
  // No se mencionó el envase: se estima automáticamente, sin preguntar.
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

/* ---------- Página ---------- */

const MODES: { id: Mode; title: string; hint: string; Icon: typeof Camera }[] = [
  { id: "foto", title: "Foto", hint: "Ticket o refri", Icon: Camera },
  { id: "voz", title: "Voz", hint: "Díctalo nomás", Icon: Microphone },
  { id: "mano", title: "A mano", hint: "Escríbelo tú", Icon: PencilSimpleLine },
];

export default function AnotarPage() {
  const [mode, setMode] = useState<Mode>("foto");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // foto
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // voz
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognition = useRef<any>(null);

  // manual
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setSavedCount(null);
  }

  /* ----- Foto ----- */

  function onFileChosen(f: File) {
    setFile(f);
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
      if (data.items.length === 0) {
        setError("No se reconocieron alimentos en la foto. Intenta con mejor luz y la imagen completa.");
      } else {
        setRows(data.items.map((it) => ({ ...it, checked: true })));
      }
    } catch {
      setError("No se pudo analizar la foto. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  }

  /* ----- Voz ----- */

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
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
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
      } else {
        setError("No entendí productos en el dictado. Intenta de nuevo, por ejemplo: “dos litros de leche y una lata de atún”.");
      }
    }
  }

  /* ----- Manual ----- */

  function addManual() {
    const name = manualName.trim();
    if (name.length < 2) return;
    setRows((prev) => [
      ...prev,
      { name, quantity: manualQty, price: 0, material: guessMaterial(name), category: "otros", checked: true },
    ]);
    setManualName("");
    setManualQty(1);
  }

  /* ----- Guardar ----- */

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
      setRows([]);
      setPreview(null);
      setFile(null);
      setTranscript("");
      setSavedCount(chosen.length);
    } catch {
      setError("No se pudieron guardar los productos. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const checkedCount = rows.filter((r) => r.checked).length;

  return (
    <main>
      <header className="px-5 pt-10 pb-6" style={{ background: "var(--chicha)", color: "#fff" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1.12 }}>
          Anotar lo que llegó
        </h1>
        <p className="mt-1.5" style={{ fontSize: 14.5, color: "oklch(0.88 0.03 315)" }}>
          Cada producto es un nudo nuevo en tu quipu.
        </p>
      </header>

      <div className="px-5 pt-5">
        {/* Selector de modo */}
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-2xl"
          style={{ background: "var(--chicha-tint)" }}
          role="tablist"
          aria-label="Forma de anotar"
        >
          {MODES.map(({ id, title, hint, Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(id)}
                className="flex flex-col items-center gap-0.5 rounded-xl py-2.5 transition-colors"
                style={{
                  background: active ? "var(--surface)" : "transparent",
                  boxShadow: active ? "var(--shadow-1)" : "none",
                }}
              >
                <Icon size={20} weight={active ? "fill" : "regular"} color={active ? "var(--chicha)" : "var(--ink-soft)"} />
                <span style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--chicha)" : "var(--ink-soft)" }}>
                  {title}
                </span>
                <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{hint}</span>
              </button>
            );
          })}
        </div>

        {/* ----- Foto ----- */}
        {mode === "foto" && (
          <div className="mt-5 anim-fade">
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
                  height: 190,
                  border: "2px dashed var(--line)",
                  borderRadius: "var(--radius)",
                  background: "var(--surface)",
                }}
              >
                <Camera size={34} color="var(--chicha-mid)" weight="duotone" />
                <span style={{ fontSize: 14, color: "var(--ink-soft)", maxWidth: 220 }} className="text-center">
                  Toca para fotografiar tu ticket de compra o el interior de tu refri
                </span>
              </button>
            ) : (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Vista previa de la foto"
                  className="w-full object-cover"
                  style={{ maxHeight: 250, borderRadius: "var(--radius)", boxShadow: "var(--shadow-1)" }}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setPreview(null);
                      setFile(null);
                      setRows([]);
                    }}
                    className="rounded-full px-5 py-3 font-semibold active:scale-95 transition-transform"
                    style={{ fontSize: 14, border: "1.5px solid var(--line)", color: "var(--ink-soft)", background: "var(--surface)" }}
                  >
                    Cambiar
                  </button>
                  <button
                    onClick={analyze}
                    disabled={analyzing}
                    className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 font-semibold active:scale-[0.98] transition-transform disabled:opacity-70"
                    style={{ fontSize: 14.5, background: "var(--chicha)", color: "#fff" }}
                  >
                    {analyzing ? (
                      <>
                        <CircleNotch size={17} className="animate-spin" /> Leyendo la foto…
                      </>
                    ) : (
                      <>
                        <Sparkle size={17} weight="fill" /> Identificar productos
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----- Voz ----- */}
        {mode === "voz" && (
          <div className="mt-7 flex flex-col items-center anim-fade">
            {!voiceSupported ? (
              <p style={{ fontSize: 14, color: "var(--urgente-ink)" }} className="text-center px-4">
                Tu navegador no soporta dictado por voz. Prueba con Chrome, o anótalo a mano.
              </p>
            ) : (
              <>
                <button
                  onClick={listening ? stopVoice : startVoice}
                  aria-label={listening ? "Terminar dictado" : "Empezar a dictar"}
                  className={`flex items-center justify-center rounded-full active:scale-95 transition-all ${listening ? "anim-pulse" : ""}`}
                  style={{
                    width: 96,
                    height: 96,
                    background: listening ? "var(--qantu)" : "var(--surface)",
                    border: listening ? "none" : "1.5px solid var(--line)",
                    boxShadow: listening ? "none" : "var(--shadow-1)",
                  }}
                >
                  <Microphone size={38} color={listening ? "#fff" : "var(--qantu)"} weight={listening ? "fill" : "duotone"} />
                </button>
                <p className="mt-3" style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>
                  {listening ? "Escuchando… toca para terminar" : "Toca y dicta: “dos litros de leche, una lata de atún”"}
                </p>
                {transcript && (
                  <p
                    className="mt-4 text-center px-4 py-3 w-full"
                    style={{
                      fontSize: 14,
                      color: "var(--ink-soft)",
                      background: "var(--surface)",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--line-soft)",
                    }}
                  >
                    “{transcript}”
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ----- A mano ----- */}
        {mode === "mano" && (
          <div className="mt-5 anim-fade">
            <label htmlFor="manual-name" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>
              ¿Qué llegó a casa?
            </label>
            <div className="flex gap-2 mt-1.5">
              <input
                id="manual-name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManual()}
                placeholder="Ej. yogur de fresa"
                className="flex-1 min-w-0 px-4 py-3 rounded-xl outline-none focus:ring-2"
                style={{
                  fontSize: 15,
                  background: "var(--surface)",
                  border: "1.5px solid var(--line)",
                  color: "var(--ink)",
                }}
              />
              <div
                className="flex items-center rounded-xl"
                style={{ border: "1.5px solid var(--line)", background: "var(--surface)" }}
              >
                <button
                  onClick={() => setManualQty((q) => Math.max(1, q - 1))}
                  aria-label="Menos"
                  className="px-2.5 py-3 active:scale-90 transition-transform"
                >
                  <Minus size={15} color="var(--ink-soft)" />
                </button>
                <span style={{ fontSize: 15, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{manualQty}</span>
                <button
                  onClick={() => setManualQty((q) => Math.min(99, q + 1))}
                  aria-label="Más"
                  className="px-2.5 py-3 active:scale-90 transition-transform"
                >
                  <Plus size={15} color="var(--ink-soft)" />
                </button>
              </div>
            </div>
            <button
              onClick={addManual}
              disabled={manualName.trim().length < 2}
              className="w-full mt-3 rounded-full py-3 font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
              style={{ fontSize: 14.5, background: "var(--chicha)", color: "#fff" }}
            >
              Agregar a la lista
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p
            className="mt-4 px-4 py-3 anim-fade"
            style={{
              fontSize: 13.5,
              background: "var(--urgente-tint)",
              color: "var(--urgente-ink)",
              borderRadius: "var(--radius)",
            }}
          >
            {error}
          </p>
        )}

        {/* Confirmación de guardado */}
        {savedCount !== null && rows.length === 0 && (
          <div
            className="mt-5 px-4 py-4 anim-knot text-center"
            style={{ background: "var(--fresco-tint)", borderRadius: "var(--radius)" }}
          >
            <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--fresco-ink)" }}>
              {savedCount} nudo{savedCount === 1 ? "" : "s"} anudado{savedCount === 1 ? "" : "s"} ✓
            </p>
            <Link
              href="/"
              className="inline-block mt-1"
              style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fresco-ink)", textDecoration: "underline" }}
            >
              Ver mi despensa
            </Link>
          </div>
        )}

        {/* ----- Revisión ----- */}
        {rows.length > 0 && (
          <div className="mt-6">
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--ink)" }}>
              Revisa antes de anudar
            </h2>
            <p className="mt-0.5 mb-3" style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
              Destacha lo que no quieras guardar.
            </p>
            <ul className="flex flex-col gap-2">
              {rows.map((row, i) => {
                const mat = MATERIALS[row.material] ?? MATERIALS.desconocido;
                const bag = bagFor(row.material);
                return (
                  <li key={`${row.name}-${i}`} className="anim-knot" style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}>
                    <div
                      className="flex items-center gap-3 px-3.5 py-3 cursor-pointer"
                      style={{
                        background: "var(--surface)",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--line-soft)",
                        opacity: row.checked ? 1 : 0.5,
                      }}
                      onClick={() =>
                        setRows((prev) => prev.map((r, j) => (j === i ? { ...r, checked: !r.checked } : r)))
                      }
                    >
                      <span
                        className="flex items-center justify-center rounded-full shrink-0"
                        style={{
                          width: 22,
                          height: 22,
                          border: `2px solid ${row.checked ? "var(--chicha)" : "var(--line)"}`,
                          background: row.checked ? "var(--chicha)" : "transparent",
                        }}
                        aria-hidden
                      >
                        {row.checked && <Check size={12} color="#fff" weight="bold" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>
                          {row.name}
                          {row.quantity > 1 && (
                            <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}> ×{row.quantity}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                          {row.price > 0 && <>S/ {row.price.toFixed(2)} · </>}
                          {mat.label}
                          <span aria-hidden className="rounded-full inline-block" style={{ width: 8, height: 8, background: bag.color }} />
                          {bag.short}
                        </span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRows((prev) => prev.filter((_, j) => j !== i));
                        }}
                        aria-label={`Quitar ${row.name}`}
                        className="shrink-0 p-1.5 active:scale-90 transition-transform"
                      >
                        <X size={15} color="var(--ink-faint)" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={save}
              disabled={saving || checkedCount === 0}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-full py-3.5 font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ fontSize: 15, background: "var(--chicha)", color: "#fff" }}
            >
              {saving ? (
                <>
                  <CircleNotch size={17} className="animate-spin" /> Anudando…
                </>
              ) : (
                `Anudar ${checkedCount} producto${checkedCount === 1 ? "" : "s"}`
              )}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
