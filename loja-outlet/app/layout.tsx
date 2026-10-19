import type { Metadata } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";

// fontes hospedadas pelo próprio site (sem pedido bloqueante ao Google Fonts)
const archivo = Archivo_Black({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-archivo" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "800"], display: "swap", variable: "--font-inter" });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.seoTitle, template: `%s | ${s.name}` },
    description: s.seoDescription,
    icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
    metadataBase: process.env.BASE_URL ? new URL(process.env.BASE_URL) : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${inter.variable}`} style={{ ["--accent" as string]: s.accent }}>
      <body>{children}</body>
    </html>
  );
}
