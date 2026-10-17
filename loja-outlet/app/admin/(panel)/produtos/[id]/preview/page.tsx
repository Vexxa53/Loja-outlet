import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { brl } from "@/lib/money";
import { effectivePrice } from "@/lib/pricing";

export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("products.write");
  const p = await db.product.findUnique({ where: { id: (await params).id }, include: { images: { orderBy: { position: "asc" } }, variants: true } });
  if (!p) notFound();
  return (
    <div className="space-y-4"><p className="flash">Pré-visualização ({p.status}) — não visível na loja até publicar.</p>
      <div className="grid gap-6 md:grid-cols-2"><div className="space-y-2">{p.images.map((i) =>   <img key={i.id} src={i.url} alt="" className="w-full" />)}</div>
        <div><h1 className="h-display text-3xl">{p.name}</h1><p className="mt-2 text-2xl font-extrabold text-accent">{brl(effectivePrice(p))}</p><p className="mt-4 whitespace-pre-line">{p.description}</p>
          <p className="mt-4 text-sm text-mute">{p.variants.map((v) => `${v.color}/${v.size} (${v.stock})`).join(" · ")}</p></div></div></div>
  );
}
