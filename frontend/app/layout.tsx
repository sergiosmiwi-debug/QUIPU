import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "QuipuRecicla — el quipu de tu casa",
  description:
    "Anota lo que entra a tu cocina, entérate antes de que se pase y sabe a qué bolsa va cada envase.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#3d2450",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-PE">
      <body>
        <div className="max-w-md mx-auto min-h-screen relative" style={{ background: "var(--bg)" }}>
          {children}
          {/* espacio para la barra de navegación fija */}
          <div style={{ height: 96 }} aria-hidden />
          <Nav />
        </div>
      </body>
    </html>
  );
}
