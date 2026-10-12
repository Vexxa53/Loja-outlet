import type { Metadata } from "next";
import { requireTenant } from "@/lib/auth/context";
import { getAdminCategories } from "@/lib/data/admin";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProduct() {
  const ctx = await requireTenant();
  const categories = await getAdminCategories(ctx.tenantId);
  return (
    <>
      <PageHeader title="Novo produto" description="Preencha os dados, adicione fotos e defina o estoque de cada tamanho e cor." />
      <ProductForm
        canSeeCost={ctx.role !== "staff"}
        categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
        variants={[]} images={[]}
        initial={{ name: "", description: "", categoryId: "", sku: "", regularPrice: "", promotionalPrice: "", costPrice: "", composition: "", careInstructions: "", sizeGuide: "", weightGrams: "", lengthCm: "", widthCm: "", heightCm: "", tags: "", status: "draft", featured: false }}
      />
    </>
  );
}
