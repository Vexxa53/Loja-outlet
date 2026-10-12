import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/auth/context";
import { getAdminCategories } from "@/lib/data/admin";
import { mediaUrl } from "@/lib/env";
import { deleteCategory } from "@/lib/actions/catalog";
import { CategoryForm } from "@/components/admin/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Card, EmptyState, Flash, PageHeader, tableCls } from "@/components/ui";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTenant();
  const categories = await getAdminCategories(ctx.tenantId);
  const editing = categories.find((c) => c.id === sp.editar);
  return (
    <>
      <PageHeader title="Categorias" description="Organize a vitrine em coleções, como Vestidos, Camisetas ou Acessórios." />
      <Flash ok={sp.ok} erro={sp.erro} />
      <Card className="mb-8">
        <h2 className="mb-4 font-serif text-xl">{editing ? `Editar “${editing.name}”` : "Nova categoria"}</h2>
        <CategoryForm key={editing?.id ?? "new"} category={editing} imageUrl={mediaUrl(editing?.image_path)} />
        {editing && <Link href="/admin/categorias" className="mt-3 inline-block text-sm underline">Cancelar edição</Link>}
      </Card>
      {categories.length === 0 ? <EmptyState title="Nenhuma categoria ainda">Crie a primeira acima.</EmptyState> : (
        <div className={tableCls.wrap}>
          <table className={tableCls.table}>
            <thead><tr>{["Categoria", "Endereço", "Ordem", "Situação", ""].map((h) => <th key={h} className={tableCls.th}>{h}</th>)}</tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className={tableCls.td}><span className="font-medium">{c.name}</span>{c.description && <p className="text-xs text-muted">{c.description}</p>}</td>
                  <td className={tableCls.td}><code className="text-xs">{c.slug}</code></td>
                  <td className={tableCls.td}>{c.sort_order}</td>
                  <td className={tableCls.td}>{c.active ? <Badge tone="green">Visível</Badge> : <Badge>Oculta</Badge>}</td>
                  <td className={`${tableCls.td} space-x-4 text-right`}>
                    <Link href={`/admin/categorias?editar=${c.id}`} className="text-sm underline">Editar</Link>
                    <form action={deleteCategory} className="inline"><input type="hidden" name="id" value={c.id} /><ConfirmButton message={`Excluir a categoria “${c.name}”? Os produtos dela ficarão sem categoria.`}>Excluir</ConfirmButton></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
