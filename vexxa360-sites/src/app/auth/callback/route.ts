import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/** Origem que o navegador realmente usou (atrás de proxy/Vercel o host interno pode ser outro). */
function originOf(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0] ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

// Troca o código do e-mail (recuperação de senha / convite) por uma sessão.
// O redirecionamento volta para o MESMO host de onde veio o pedido, senão o cookie do PKCE se perde.
export async function GET(request: NextRequest) {
  const origin = originOf(request);
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/admin");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?erro=link`);
}
