import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/data/store";
import { CartView } from "@/components/store/cart-view";

export const metadata: Metadata = { title: "Sacola", robots: { index: false, follow: false } };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <CartView slug={slug} hasWhatsapp={!!store.settings.whatsapp} />
    </div>
  );
}
