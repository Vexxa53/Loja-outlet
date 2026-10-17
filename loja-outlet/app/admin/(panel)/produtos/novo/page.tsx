import { requireAdmin } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { ProductForm } from "../ProductForm";

export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireAdmin("products.write");
  const sp = await searchParams;
  return (<div className="space-y-4"><h1 className="h-display text-2xl">Novo produto</h1><Flash erro={sp.erro} /><ProductForm /></div>);
}
