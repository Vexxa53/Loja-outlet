import { requireAdmin } from "@/lib/auth";
import { productFormData } from "../form-data";
import { ProductForm } from "../ProductForm";

export default async function Page() {
  const admin = await requireAdmin("products.write");
  const { categories, grids } = await productFormData();
  return (<div className="space-y-4"><h1 className="h-display text-2xl">Novo produto</h1><ProductForm categories={categories} grids={grids} canEditStock={admin.role.permissions.includes("stock.write")} /></div>);
}
