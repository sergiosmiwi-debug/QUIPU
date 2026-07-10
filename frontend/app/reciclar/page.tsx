"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowSquareOut,
  CircleNotch,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
} from "@phosphor-icons/react";
import { BAGS, MATERIALS, type Bag } from "@/lib/materials";
import type { Material } from "@/lib/types";

/* ---------- ¿A qué bolsa va? — buscador local ---------- */

interface Answer {
  bag: Bag;
  detail: string;
}

/* Respuestas curadas para lo que la gente bota a diario. Sin inventos:
   solo casos donde la regla peruana es clara. */
const LOOKUP: { keys: string[]; answer: Answer }[] = [
  { keys: ["botella", "plastico", "plástico", "gaseosa", "agua", "pet"], answer: { bag: "verde", detail: "Enjuágala, aplástala y tápala de nuevo." } },
  { keys: ["vidrio", "frasco", "cerveza", "vino", "pisco", "mermelada"], answer: { bag: "verde", detail: "Enjuágalo y ponlo entero, sin romper." } },
  { keys: ["lata", "atun", "atún", "conserva", "metal", "aluminio"], answer: { bag: "verde", detail: "Enjuágala y aplástala si puedes." } },
  { keys: ["carton", "cartón", "caja", "papel", "periodico", "periódico", "cuaderno"], answer: { bag: "carton", detail: "Desármalo y guárdalo plano, seco y limpio." } },
  { keys: ["caja de pizza", "pizza"], answer: { bag: "negra", detail: "El cartón con grasa ya no se recicla." } },
  { keys: ["tetrapak", "tetra pak", "caja de leche", "caja de jugo"], answer: { bag: "verde", detail: "Enjuágalo y aplástalo. Si tu distrito no recibe tetrapak, va a la negra." } },
  { keys: ["cascara", "cáscara", "resto", "comida", "fruta podrida", "organico", "orgánico"], answer: { bag: "negra", detail: "O compóstalo si puedes: reduces más de la mitad de tu basura." } },
  { keys: ["tecnopor", "tecknopor", "poliestireno"], answer: { bag: "negra", detail: "El tecnopor no se recicla en el Perú." } },
  { keys: ["bolsa", "envoltura", "sachet", "galleta"], answer: { bag: "negra", detail: "Las envolturas plásticas flexibles no entran al reciclaje común." } },
  { keys: ["pilas", "pila", "bateria", "batería"], answer: { bag: "desconocido", detail: "Las pilas NO van en ninguna bolsa: llévalas a un punto de acopio especial (muchas municipalidades y supermercados tienen)." } },
  { keys: ["aceite usado"], answer: { bag: "desconocido", detail: "El aceite no se bota al caño ni a la bolsa: júntalo en una botella y llévalo a un punto de acopio." } },
];

function lookupAnswer(q: string): Answer | null {
  const norm = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (norm.trim().length < 3) return null;
  // primero las claves más largas (más específicas)
  const flat = LOOKUP.flatMap((e) => e.keys.map((k) => ({ key: k.normalize("NFD").replace(/[̀-ͯ]/g, ""), answer: e.answer })));
  flat.sort((a, b) => b.key.length - a.key.length);
  for (const { key, answer } of flat) {
    if (norm.includes(key)) return answer;
  }
  return null;
}

/* ---------- Guía de bolsas ---------- */

const GUIDE: { bag: Bag; items: string; note: string }[] = [
  {
    bag: "verde",
    items: "Botellas de plástico · vidrio · latas",
    note: "Todo enjuagado y seco. Un envase sucio contamina la bolsa entera. En muchos distritos el recolector de reciclables pasa una vez por semana.",
  },
  {
    bag: "carton",
    items: "Cajas desarmadas · papel limpio · cartón de huevos",
    note: "Plano, seco y limpio, en una caja aparte. El cartón mojado o con grasa (como el de pizza) va a la bolsa negra.",
  },
  {
    bag: "negra",
    items: "Restos de comida · envolturas sucias · tecnopor",
    note: "Todo lo que no se puede reciclar. Si compostas los restos orgánicos, reduces más de la mitad de tu basura.",
  },
];

/* ---------- Ecopuntos ---------- */

interface EcoPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  materials: Material[];
  distanceKm: number;
}

const LIMA_FALLBACK: Omit<EcoPoint, "distanceKm">[] = [
  { id: "f1", name: "Punto Limpio — Parque Kennedy, Miraflores", lat: -12.1219, lng: -77.0297, materials: ["plastico", "vidrio", "metal", "carton"] },
  { id: "f2", name: "Estación de reciclaje — Parque de la Amistad, Surco", lat: -12.1359, lng: -76.9911, materials: ["plastico", "vidrio", "carton"] },
  { id: "f3", name: "Ecopunto Municipal — Plaza San Miguel", lat: -12.0776, lng: -77.0824, materials: ["plastico", "vidrio", "metal"] },
  { id: "f4", name: "Punto de acopio — Parque El Olivar, San Isidro", lat: -12.0983, lng: -77.0365, materials: ["plastico", "carton"] },
  { id: "f5", name: "Ecopunto — Parque de la Exposición, Cercado", lat: -12.0622, lng: -77.0365, materials: ["plastico", "vidrio", "metal", "carton"] },
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

/* ---------- Página ---------- */

export default function ReciclarPage() {
  const [query, setQuery] = useState("");
  const [openBag, setOpenBag] = useState<Bag | null>(null);

  const [points, setPoints] = useState<EcoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoDenied, setGeoDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoDenied(true);
      setPoints(LIMA_FALLBACK.map((p) => ({ ...p, distanceKm: -1 })));
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
        setPoints(
          raw
            .map((p) => ({ ...p, distanceKm: haversineKm(lat, lng, p.lat, p.lng) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
        );
        setLoading(false);
      },
      () => {
        setGeoDenied(true);
        setPoints(LIMA_FALLBACK.map((p) => ({ ...p, distanceKm: -1 })));
        setLoading(false);
      },
      { timeout: 10000 }
    );
  }, []);

  const answer = useMemo(() => lookupAnswer(query), [query]);

  let visible: EcoPoint[] = [];
  if (points.length > 0 && points[0].distanceKm < 0) {
    visible = points.slice(0, 3);
  } else {
    for (const radius of [3, 4, 5, Infinity]) {
      visible = points.filter((p) => p.distanceKm <= radius).slice(0, 3);
      if (visible.length >= 3) break;
    }
  }

  return (
    <main>
      <header className="px-5 pt-10 pb-6" style={{ background: "var(--chicha)", color: "#fff" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1.12 }}>
          ¿A qué bolsa va?
        </h1>
        <p className="mt-1.5" style={{ fontSize: 14.5, color: "oklch(0.88 0.03 315)" }}>
          Escribe lo que vas a botar y te decimos dónde va.
        </p>

        {/* Buscador */}
        <div className="relative mt-4">
          <MagnifyingGlass
            size={18}
            color="var(--ink-faint)"
            className="absolute left-4 top-1/2 -translate-y-1/2"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. caja de pizza, lata de atún, pilas…"
            aria-label="¿Qué vas a botar?"
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl outline-none"
            style={{ fontSize: 15, background: "var(--surface)", color: "var(--ink)" }}
          />
        </div>
      </header>

      <div className="px-5 pt-4">
        {/* Respuesta del buscador */}
        {query.trim().length >= 3 && (
          <div className="anim-knot mb-4">
            {answer ? (
              <div
                className="px-4 py-3.5 rounded-2xl"
                style={{ background: BAGS[answer.bag].tint, border: `1.5px solid ${BAGS[answer.bag].color}` }}
              >
                <p className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                  <span aria-hidden className="rounded-full inline-block shrink-0" style={{ width: 12, height: 12, background: BAGS[answer.bag].color }} />
                  {answer.bag === "desconocido" ? "Caso especial" : BAGS[answer.bag].name}
                </p>
                <p className="mt-1" style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  {answer.detail}
                </p>
              </div>
            ) : (
              <p className="px-4 py-3 rounded-2xl" style={{ fontSize: 13.5, background: "var(--line-soft)", color: "var(--ink-soft)" }}>
                No tenemos ese caso registrado. Si no estás seguro, mejor bolsa negra: un reciclable dudoso no contamina, pero un no-reciclable en la bolsa verde sí.
              </p>
            )}
          </div>
        )}

        {/* Las tres bolsas */}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)" }}>
          Así se separa en casa
        </h2>
        <ul className="flex flex-col gap-2.5 mt-3">
          {GUIDE.map(({ bag, items, note }, i) => {
            const info = BAGS[bag];
            const open = openBag === bag;
            return (
              <li key={bag} className="anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <button
                  onClick={() => setOpenBag(open ? null : bag)}
                  aria-expanded={open}
                  className="w-full text-left px-4 py-4 rounded-2xl active:scale-[0.99] transition-transform"
                  style={{ background: info.tint }}
                >
                  <p className="flex items-center gap-2.5" style={{ fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>
                    <span
                      aria-hidden
                      className="inline-block shrink-0 rounded-full"
                      style={{ width: 14, height: 14, background: info.color, boxShadow: `0 0 0 3px ${info.tint}, 0 0 0 4.5px ${info.color}40` }}
                    />
                    {info.name}
                  </p>
                  <p className="mt-1 ml-[26px]" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                    {items}
                  </p>
                  {open && (
                    <p className="mt-2 ml-[26px] anim-fade" style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.55 }}>
                      {note}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Ecopuntos */}
        <h2 className="mt-7" style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)" }}>
          Ecopuntos cerca de ti
        </h2>
        {geoDenied && (
          <p className="mt-1" style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
            Sin acceso a tu ubicación — mostrando puntos conocidos de Lima.
          </p>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center" style={{ color: "var(--ink-faint)" }}>
            <CircleNotch size={17} className="animate-spin" />
            <span style={{ fontSize: 13.5 }}>Buscando cerca de ti…</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5 mt-3 pb-2">
            {visible.map((p, i) => (
              <li
                key={p.id}
                className="anim-rise flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                style={{ background: "var(--surface)", border: "1px solid var(--line-soft)", animationDelay: `${i * 60}ms` }}
              >
                <MapPin size={22} color="var(--chicha-mid)" weight="duotone" className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{p.name}</p>
                  <p className="flex items-center gap-2 mt-0.5" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    {p.distanceKm >= 0 && (
                      <span className="flex items-center gap-1">
                        <NavigationArrow size={11} />
                        {p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm.toFixed(1)} km`}
                      </span>
                    )}
                    <span>{p.materials.map((m) => MATERIALS[m].label).join(" · ")}</span>
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Cómo llegar a ${p.name}`}
                  className="flex items-center justify-center shrink-0 rounded-xl active:scale-90 transition-transform"
                  style={{ width: 38, height: 38, background: "var(--chicha)" }}
                >
                  <ArrowSquareOut size={17} color="#fff" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
