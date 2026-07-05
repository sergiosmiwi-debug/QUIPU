import type { Metadata, Viewport } from "next";
import "./globals.css";
import AmbientPlayer from "@/components/AmbientPlayer";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "QuipuRecicla",
  description:
    "Rastrea el vencimiento de tus alimentos y aprende a reciclar sus envases.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f4023",
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
          <AmbientPlayer />
          {children}
          <div style={{ height: 140 }} />
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
