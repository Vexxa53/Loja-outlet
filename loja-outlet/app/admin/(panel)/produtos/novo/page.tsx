import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ProductForm } from "../ProductForm";

export default async function Page() {
  await requireAdmin("products.write");
  const categories = await db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } });
  return (<div className="space-y-4"><h1 className="h-display text-2xl">Novo produto</h1><ProductForm categories={categories} /></div>);
}
