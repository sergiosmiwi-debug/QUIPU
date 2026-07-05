"use client";

import { useEffect, useState } from "react";
import {
  ArrowSquareOut,
  CircleNotch,
  MapPin,
  NavigationArrow,
  Package,
  Recycle,
  Trash,
} from "@phosphor-icons/react";
import HeaderWave from "@/components/HeaderWave";
import MusicButton from "@/components/MusicButton";
import { BIN_COLORS } from "@/lib/materials";
import type { Material } from "@/lib/types";

interface EcoPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  materials: Material[];
  distanceKm: number;
}

// Fallback curado de Lima si Overpass no devuelve nada
const LIMA_FALLBACK: Omit<EcoPoint, "distanceKm">[] = [
  {
    id: "f1",
    name: "Punto Limpio — Parque Kennedy, Miraflores",
    lat: -12.1219,
    lng: -77.0297,
    materials: ["plastico", "vidrio", "metal", "carton"],
  },
  {
    id: "f2",
    name: "Estación de reciclaje — Parque de la Amistad, Surco",
    lat: -12.1359,
    lng: -76.9911,
    materials: ["plastico", "vidrio", "carton"],
  },
  {
    id: "f3",
    name: "Ecopunto Municipal — Plaza San Miguel",
    lat: -12.0776,
    lng: -77.0824,
    materials: ["plastico", "vidrio", "metal"],
  },
  {
    id: "f4",
    name: "Punto de acopio — Parque El Olivar, San Isidro",
    lat: -12.0983,
    lng: -77.0365,
    materials: ["plastico", "carton"],
  },
  {
    id: "f5",
    name: "Ecopunto — Parque de la Exposición, Cercado",
    lat: -12.0622,
    lng: -77.0365,
    materials: ["plastico", "vidrio", "metal", "carton"],
  },
];

const MATERIAL_FILTERS: { id: Material; label: string }[] = [
  { id: "plastico", label: "Plástico" },
  { id: "vidrio", label: "Vidrio" },
  { id: "metal", label: "Metal" },
  { id: "carton", label: "Cartón" },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Mapea tags recycling:* de OSM a nuestros materiales
const OSM_TAG_MAP: Record<string, Material> = {
  "recycling:plastic": "plastico",
  "recycling:plastic_bottles": "plastico",
  "recycling:plastic_packaging": "plastico",
  "recycling:pet": "plastico",
  "recycling:glass": "vidrio",
  "recycling:glass_bottles": "vidrio",
  "recycling:cans": "metal",
  "recycling:scrap_metal": "metal",
  "recycling:aluminium": "metal",
  "recycling:paper": "carton",
  "recycling:cardboard": "carton",
  "recycling:paper_packaging": "carton",
};

async function fetchOverpass(lat: number, lng: number): Promise<Omit<EcoPoint, "distanceKm">[]> {
  const query = `[out:json][timeout:12];node["amenity"="recycling"](around:5000,${lat},${lng});out;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error("overpass");
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.elements ?? []).map((el: any) => {
    const materials = new Set<Material>();
    for (const [tag, val] of Object.entries(el.tags ?? {})) {
      if (val === "yes" && OSM_TAG_MAP[tag]) materials.add(OSM_TAG_MAP[tag]);
    }
    if (materials.size === 0) {
      materials.add("plastico");
      materials.add("vidrio");
      materials.add("metal");
    }
    return {
      id: String(el.id),
      name: el.tags?.name ?? el.tags?.operator ?? "Punto de reciclaje",
      lat: el.lat,
      lng: el.lon,
      materials: [...materials],
    };
  });
}

// Guía de segregación doméstica peruana
const GUIDE = [
  {
    color: BIN_COLORS.verde,
    Icon: Recycle,
    title: "Bolsa verde · Reciclables",
    body: "Botellas de plástico, frascos y botellas de vidrio, latas de metal. Enjuágalos y sécalos antes de ponerlos: un envase sucio contamina toda la bolsa. En muchos distritos el recolector de reciclables pasa una vez por semana.",
  },
  {
    color: BIN_COLORS.caja,
    Icon: Package,
    title: "Caja aparte · Cartón y papel",
    body: "Cajas desarmadas, papel limpio, cartón de huevos. Guárdalos planos y secos en una caja: el cartón mojado o con grasa (como el de pizza) ya no se recicla y va a la bolsa negra.",
  },
  {
    color: BIN_COLORS.negra,
    Icon: Trash,
    title: "Bolsa negra · Generales y orgánico",
    body: "Restos de comida, cáscaras, envolturas sucias, tecnopor y todo lo que no se pueda reciclar. Si puedes compostar los restos orgánicos, mejor: reduces más de la mitad de tu basura.",
  },
];

export default function EcopuntosPage() {
  const [points, setPoints] = useState<EcoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoDenied, setGeoDenied] = useState(false);
  const [filter, setFilter] = useState<Material | "todos">("todos");

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let raw: Omit<EcoPoint, "distanceKm">[] = [];
        try {
          raw = await fetchOverpass(lat, lng);
        } catch {
          // fallback silencioso a la lista curada
        }
        if (raw.length === 0) raw = LIMA_FALLBACK;
        const withDist = raw
          .map((p) => ({ ...p, distanceKm: haversineKm(lat, lng, p.lat, p.lng) }))
          .sort((a, b) => a.distanceKm - b.distanceKm);
        setPoints(withDist);
        setLoading(false);
      },
      () => {
        // sin ubicación: mostramos la lista curada sin distancias reales
        setGeoDenied(true);
        setPoints(LIMA_FALLBACK.map((p) => ({ ...p, distanceKm: -1 })));
        setLoading(false);
      },
      { timeout: 10000 }
    );
  }, []);

  const byMaterial =
    filter === "todos" ? points : points.filter((p) => p.materials.includes(filter));

  // Radio dinámico: 3km → 4 → 5 → sin límite, siempre máximo 3
  let visible: EcoPoint[] = [];
  if (byMaterial.length > 0 && byMaterial[0].distanceKm < 0) {
    visible = byMaterial.slice(0, 3);
  } else {
    for (const radius of [3, 4, 5, Infinity]) {
      visible = byMaterial.filter((p) => p.distanceKm <= radius).slice(0, 3);
      if (visible.length >= 3) break;
    }
  }

  return (
    <main>
      <header
        className="sticky top-0 z-40 px-5 pt-12 pb-12"
        style={{ background: "var(--gradient-header)" }}
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
              Eco<em style={{ color: "rgba(255,255,255,0.75)" }}>Puntos</em>
            </h1>
            <p
              className="uppercase mt-1"
              style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em" }}
            >
              Dónde llevar tus reciclables
            </p>
          </div>
          <div className="pt-1">
            <MusicButton />
          </div>
        </div>

        {/* Filtros por material */}
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
          {[{ id: "todos" as const, label: "Todos" }, ...MATERIAL_FILTERS].map((f) => {
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

      <div className="px-5 pt-3">
        {/* Sección 1: cercanos */}
        <h2 className="font-semibold mb-2" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          Ecopuntos cercanos
        </h2>
        {geoDenied && (
          <p className="mb-2" style={{ fontSize: 11, color: "var(--ink-3)" }}>
            Sin acceso a tu ubicación — mostrando puntos conocidos de Lima.
          </p>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <CircleNotch size={18} color="var(--ink-3)" className="animate-spin" />
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Buscando cerca de ti…</span>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-4 text-center" style={{ fontSize: 13, color: "var(--ink-3)" }}>
            No encontramos ecopuntos para ese material.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((p, i) => (
              <div
                key={p.id}
                className="anim-card p-4"
                style={{
                  background: "var(--surface)",
                  borderRadius: 20,
                  boxShadow: "var(--shadow-card)",
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 40,
                      height: 40,
                      background: "var(--brand-bg)",
                      borderRadius: 13,
                    }}
                  >
                    <MapPin size={20} color="var(--brand-mid)" weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold" style={{ fontSize: 14, color: "var(--ink-1)" }}>
                      {p.name}
                    </p>
                    {p.distanceKm >= 0 && (
                      <p className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        <NavigationArrow size={11} />
                        {p.distanceKm < 1
                          ? `${Math.round(p.distanceKm * 1000)} m`
                          : `${p.distanceKm.toFixed(1)} km`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.materials.map((m) => (
                        <span
                          key={m}
                          className="rounded-full px-2 py-0.5"
                          style={{
                            fontSize: 10,
                            background: "var(--muted-bg)",
                            color: "var(--muted-txt)",
                          }}
                        >
                          {MATERIAL_FILTERS.find((f) => f.id === m)?.label ?? m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Cómo llegar"
                    className="flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                    style={{
                      width: 34,
                      height: 34,
                      background: "var(--brand)",
                      borderRadius: 10,
                    }}
                  >
                    <ArrowSquareOut size={16} color="#fff" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sección 2: guía por material */}
        <h2 className="font-semibold mt-6 mb-2" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          Guía de segregación en casa
        </h2>
        <div className="flex flex-col gap-3">
          {GUIDE.map((g, i) => (
            <div
              key={g.title}
              className="anim-card p-4 flex gap-3"
              style={{
                background: "var(--surface)",
                borderRadius: 20,
                boxShadow: "var(--shadow-card)",
                animationDelay: `${i * 50}ms`,
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 40, height: 40, background: `${g.color}1a`, borderRadius: 13 }}
              >
                <g.Icon size={20} color={g.color} weight="duotone" />
              </div>
              <div>
                <p className="font-semibold flex items-center gap-1.5" style={{ fontSize: 14, color: "var(--ink-1)" }}>
                  <span
                    aria-hidden
                    style={{ width: 10, height: 10, borderRadius: 3, background: g.color, display: "inline-block" }}
                  />
                  {g.title}
                </p>
                <p className="mt-1" style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  {g.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
