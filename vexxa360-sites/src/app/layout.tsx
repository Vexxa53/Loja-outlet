import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Vexxa360° Sites", template: "%s" },
  description: "Lojas virtuais profissionais para moda e varejo, com painel próprio e pedidos pelo WhatsApp.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbfaf8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
