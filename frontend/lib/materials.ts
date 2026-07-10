import type { Material } from "./types";

/**
 * Segregación doméstica peruana:
 * bolsa verde (reciclables: plástico, vidrio, metal),
 * caja aparte (cartón y papel),
 * bolsa negra (generales + orgánico).
 */
export type Bag = "verde" | "carton" | "negra" | "desconocido";

export interface BagInfo {
  name: string;
  short: string;
  color: string;
  tint: string;
}

export const BAGS: Record<Bag, BagInfo> = {
  verde: {
    name: "Bolsa verde · Reciclables",
    short: "Bolsa verde",
    color: "var(--bolsa-verde)",
    tint: "var(--bolsa-verde-tint)",
  },
  carton: {
    name: "Caja aparte · Cartón y papel",
    short: "Caja de cartón",
    color: "var(--bolsa-carton)",
    tint: "var(--bolsa-carton-tint)",
  },
  negra: {
    name: "Bolsa negra · General y orgánico",
    short: "Bolsa negra",
    color: "var(--bolsa-negra)",
    tint: "var(--bolsa-negra-tint)",
  },
  desconocido: {
    name: "Sin identificar",
    short: "Por confirmar",
    color: "var(--ink-faint)",
    tint: "var(--line-soft)",
  },
};

export interface MaterialInfo {
  label: string;
  bag: Bag;
  tip: string;
}

export const MATERIALS: Record<Material, MaterialInfo> = {
  plastico: {
    label: "Plástico",
    bag: "verde",
    tip: "Enjuágalo, aplástalo y a la bolsa verde. Un envase sucio contamina toda la bolsa.",
  },
  vidrio: {
    label: "Vidrio",
    bag: "verde",
    tip: "Enjuágalo y ponlo entero (sin romper) en la bolsa verde.",
  },
  metal: {
    label: "Metal",
    bag: "verde",
    tip: "Enjuaga la lata y aplástala si puedes. Va en la bolsa verde.",
  },
  carton: {
    label: "Cartón",
    bag: "carton",
    tip: "Desármalo y guárdalo plano, seco y limpio. El cartón con grasa ya no se recicla: ese va a la negra.",
  },
  organico: {
    label: "Orgánico",
    bag: "negra",
    tip: "Restos y cáscaras van en la bolsa negra — o compóstalos si puedes.",
  },
  general: {
    label: "General",
    bag: "negra",
    tip: "Envolturas sucias o de varios materiales van en la bolsa negra.",
  },
  desconocido: {
    label: "Sin identificar",
    bag: "desconocido",
    tip: "No pudimos confirmar el envase de este producto.",
  },
};

export function bagFor(material: Material): BagInfo {
  return BAGS[MATERIALS[material]?.bag ?? "desconocido"];
}

/**
 * Mejor estimación automática de envase cuando no se pudo determinar
 * durante el análisis (p.ej. dictado por voz sin mencionar el envase).
 * Nunca se le pregunta al usuario: se asigna de una vez.
 */
export function guessMaterial(name: string): Material {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (n.includes("cerveza") || n.includes("vino") || n.includes("pisco")) return "vidrio";
  if (n.includes("mermelada") || n.includes("mayonesa")) return "vidrio";
  if (n.includes("atun") || n.includes("conserva")) return "metal";
  if (n.includes("leche") || n.includes("cereal") || n.includes("galleta") || n.includes("jugo"))
    return "carton";
  if (n.includes("gaseosa") || n.includes("agua") || n.includes("yogur") || n.includes("aceite"))
    return "plastico";
  return "plastico";
}
