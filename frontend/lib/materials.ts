import type { Material } from "./types";

// Segregación doméstica peruana: bolsa verde (reciclables), caja (cartón/papel),
// bolsa negra (generales + orgánico).
export const BIN_COLORS = {
  verde: "#1c7a4a",
  caja: "#9a6b2c",
  negra: "#2b2b2b",
  desconocido: "#b7b0a2",
} as const;

export interface MaterialInfo {
  label: string;
  binColor: string;
  binName: string;
  tip: string;
}

export const MATERIALS: Record<Material, MaterialInfo> = {
  plastico: {
    label: "Plástico",
    binColor: BIN_COLORS.verde,
    binName: "Bolsa verde",
    tip: "Enjuaga la botella o envase, aplástalo y ponlo en la bolsa verde de reciclables.",
  },
  vidrio: {
    label: "Vidrio",
    binColor: BIN_COLORS.verde,
    binName: "Bolsa verde",
    tip: "Enjuaga el frasco o botella y ponlo entero (sin romper) en la bolsa verde de reciclables.",
  },
  metal: {
    label: "Metal",
    binColor: BIN_COLORS.verde,
    binName: "Bolsa verde",
    tip: "Enjuaga la lata y aplástala si puedes. Va en la bolsa verde de reciclables.",
  },
  carton: {
    label: "Cartón",
    binColor: BIN_COLORS.caja,
    binName: "Caja de cartón",
    tip: "Desarma la caja y guárdala plana, seca y limpia, junto con el papel, en una caja aparte.",
  },
  organico: {
    label: "Orgánico",
    binColor: BIN_COLORS.negra,
    binName: "Bolsa negra",
    tip: "Restos de comida y cáscaras van en la bolsa negra (o compóstalos si puedes).",
  },
  general: {
    label: "General",
    binColor: BIN_COLORS.negra,
    binName: "Bolsa negra",
    tip: "Envolturas sucias o mixtas van en la bolsa negra de residuos generales.",
  },
  desconocido: {
    label: "Sin identificar",
    binColor: BIN_COLORS.desconocido,
    binName: "Sin identificar",
    tip: "Cuéntanos de qué es el envase para decirte dónde va.",
  },
};

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
