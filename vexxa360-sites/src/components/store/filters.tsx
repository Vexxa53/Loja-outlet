import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { btnClass } from "../ui";
import type { Category } from "@/types/db";

export type FilterValues = { q?: string; categoria?: string; tamanho?: string; cor?: string; min?: string; max?: string; disponivel?: string; promocao?: string; ordem?: string };

/** Formulário GET: os filtros ficam na URL (compartilhável, funciona sem JavaScript). */
export function Filters({ slug, values, categories, sizes, colors }: {
  slug: string; values: FilterValues; categories: Category[]; sizes: string[]; colors: string[];
}) {
  const active = Object.entries(values).filter(([k, v]) => v && k !== "ordem").length;
  return (
    <details className="group rounded-2xl border border-line bg-white lg:open:block" open>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium lg:cursor-default">
        <span className="inline-flex items-center gap-2"><SlidersHorizontal className="size-4" /> Filtros{active ? ` (${active})` : ""}</span>
      </summary>
      <form method="get" action={`/loja/${slug}/produtos`} className="grid gap-4 border-t border-line p-4 text-sm">
        <div>
          <label className="label" htmlFor="f-q">Busca</label>
          <input id="f-q" name="q" defaultValue={values.q} className="field" placeholder="Nome do produto" />
        </div>
        <div>
          <label className="label" htmlFor="f-cat">Categoria</label>
          <select id="f-cat" name="categoria" defaultValue={values.categoria ?? ""} className="field">
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {sizes.length > 0 && (
          <div>
            <label className="label" htmlFor="f-size">Tamanho</label>
            <select id="f-size" name="tamanho" defaultValue={values.tamanho ?? ""} className="field">
              <option value="">Todos</option>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {colors.length > 0 && (
          <div>
            <label className="label" htmlFor="f-color">Cor</label>
            <select id="f-color" name="cor" defaultValue={values.cor ?? ""} className="field">
              <option value="">Todas</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label" htmlFor="f-min">Preço mín.</label><input id="f-min" name="min" inputMode="decimal" defaultValue={values.min} className="field" placeholder="0" /></div>
          <div><label className="label" htmlFor="f-max">Preço máx.</label><input id="f-max" name="max" inputMode="decimal" defaultValue={values.max} className="field" placeholder="500" /></div>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" name="disponivel" value="1" defaultChecked={values.disponivel === "1"} /> Apenas disponíveis</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="promocao" value="1" defaultChecked={values.promocao === "1"} /> Apenas em promoção</label>
        <div>
          <label className="label" htmlFor="f-ord">Ordenar por</label>
          <select id="f-ord" name="ordem" defaultValue={values.ordem ?? "novidades"} className="field">
            <option value="novidades">Novidades</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className={`${btnClass.primary} flex-1`} type="submit">Aplicar</button>
          <Link className={btnClass.secondary} href={`/loja/${slug}/produtos`}>Limpar</Link>
        </div>
      </form>
    </details>
  );
}
