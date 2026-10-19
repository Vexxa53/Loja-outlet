import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";

export async function GET() {
  const admin = await getAdmin();
  if (!admin || !admin.role.permissions.includes("customers.read")) return new NextResponse("Não autorizado", { status: 403 });
  const rows = await db.newsletterSignup.findMany({ orderBy: { createdAt: "desc" }, take: 50000 });
  await audit(admin.id, "newsletter.export", "NewsletterSignup", null, { count: rows.length });
  return new NextResponse(toCsv([["Email", "Origem", "Consentimento em"], ...rows.map((r) => [r.email, r.source, r.consentAt.toISOString()])]), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="newsletter.csv"', "Cache-Control": "no-store" },
  });
}
