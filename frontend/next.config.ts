import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // rutas de la versión anterior
    return [
      { source: "/scan", destination: "/anotar", permanent: true },
      { source: "/ecopuntos", destination: "/reciclar", permanent: true },
      { source: "/dashboard", destination: "/huella", permanent: true },
    ];
  },
};

export default nextConfig;
