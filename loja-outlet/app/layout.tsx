import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";

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
    <html lang="pt-BR" style={{ ["--accent" as string]: s.accent }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;600;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
