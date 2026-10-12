import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// Primeira barreira (UX): sem sessão, /admin e /master redirecionam para /login.
// A autorização REAL é refeita em cada página/ação (lib/auth) e no banco (RLS).
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const protectedArea = path.startsWith("/admin") || path.startsWith("/master");

  if (protectedArea && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
