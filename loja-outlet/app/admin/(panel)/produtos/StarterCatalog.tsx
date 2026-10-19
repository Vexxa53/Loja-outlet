"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { installStarterCatalogBatch, removeStarterCatalog, setStarterStatus } from "@/app/actions/admin-catalog";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export function StarterCatalog({ installed, total }: { installed: number; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function install() {
    setBusy(true); setMsg(null); setPct(0);
    let offset = 0, created = 0, stored = 0, linked = 0;
    const errors: string[] = [];
    try {
      while (offset !== null) {
        const r = await installStarterCatalogBatch(offset);
        created += r.created; stored += r.imagesStored; linked += r.imagesLinked; errors.push(...r.errors);
        setPct(Math.min(100, Math.round(((r.next ?? r.total) / r.total) * 100)));
        if (r.next === null) break;
        offset = r.next;
      }
      const where = stored ? `${stored} foto(s) no armazenamento de imagens` : `${linked} foto(s) empacotadas com o site`;
      setMsg({ ok: errors.length === 0, text: `Pronto: ${created} produto(s) criado(s) (${total - created} já existiam). ${where}.${errors.length ? ` Avisos: ${errors.slice(0, 3).join(" · ")}` : ""}` });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "A instalação foi interrompida. Clique de novo: ela continua de onde parou, sem duplicar nada." });
    } finally { setBusy(false); }
  }

  return (
    <section className="card space-y-3 border-accent p-4" aria-labelledby="starter-title">
      <h2 id="starter-title" className="font-bold uppercase">Catálogo inicial de demonstração</h2>
      <p className="text-sm text-mute">
        {installed >= total
          ? `Os ${total} produtos de exemplo estão cadastrados. São apenas para a vitrine: troque nomes, preços, estoques e fotos pelos seus produtos reais, ou coloque-os como Inativos / remova-os antes de vender.`
          : `Cadastra ${total} produtos de exemplo (camisas, calças, tênis, blusas e jaquetas, relógios) com fotos, tamanhos e estoque. Pode ser repetido sem duplicar. Fotos ilustrativas: não mostram os produtos reais da loja.`}
      </p>
      {installed > 0 && installed < total && <p className="text-sm">Já existem {installed} de {total}.</p>}
      {busy && <div role="status" className="flash">Instalando... {pct}%<div className="mt-1 h-1.5 bg-ink"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div></div>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`flash ${msg.ok ? "" : "flash-err"}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        {installed < total && <button className="btn" onClick={install} disabled={busy}>{busy ? "Instalando..." : installed ? "Completar catálogo inicial" : `Instalar catálogo inicial (${total} produtos)`}</button>}
        {installed > 0 && (
          <>
            <form action={setStarterStatus}><input type="hidden" name="status" value="DRAFT" /><ConfirmButton className="btn btn-ghost" message="Colocar TODOS os produtos do catálogo inicial como Inativos? Eles somem da loja.">Colocar todos como Inativos</ConfirmButton></form>
            <form action={setStarterStatus}><input type="hidden" name="status" value="PUBLISHED" /><button className="btn btn-ghost">Colocar todos como Ativos</button></form>
            <form action={removeStarterCatalog}><ConfirmButton message="Remover TODOS os produtos do catálogo inicial? Produtos já vendidos serão apenas arquivados. Esta ação não pode ser desfeita.">Remover catálogo inicial</ConfirmButton></form>
          </>
        )}
      </div>
    </section>
  );
}
