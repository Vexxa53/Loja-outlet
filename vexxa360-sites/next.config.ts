import type { NextConfig } from "next";

// Origem do Supabase Storage liberada para o otimizador de imagens (protocolo, host e porta vêm da URL do projeto).
// Em produção é https://<ref>.supabase.co; no Supabase local é http://127.0.0.1:54321.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : undefined;
const isLocalSupabase = !!supabase && /^(localhost|127\.|\[::1\])/.test(supabase.hostname);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: supabase
      ? [{
          protocol: supabase.protocol.replace(":", "") as "http" | "https",
          hostname: supabase.hostname,
          ...(supabase.port ? { port: supabase.port } : {}),
          pathname: "/storage/v1/object/public/store-media/**",
        }]
      : [],
    // O otimizador bloqueia IPs privados; só liberamos quando o Supabase é local (desenvolvimento/testes).
    dangerouslyAllowLocalIP: isLocalSupabase,
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Uploads de imagem passam por Server Action (a Vercel limita o corpo a ~4,5 MB).
    serverActions: { bodySizeLimit: "4500kb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
