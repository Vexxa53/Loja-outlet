import { memoPerRequest } from "./memo";
import { db } from "./db";
import { DEFAULT_SHIPPING, type ShippingConfig } from "./pricing";

export type StoreSettings = {
  name: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  accent: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  about: string;
  privacyPolicy: string;
  termsPolicy: string;
  exchangePolicy: string;
  seoTitle: string;
  seoDescription: string;
  // até 3 frases da barra de avisos no topo; vazio = usa as frases padrão (frete grátis, troca, atendimento)
  promoBar: string[];
  homeSections: { featured: string; news: string; bestSellers: string; sale: string };
  shipping: ShippingConfig;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  name: "Outlet 3K",
  tagline: "Moda, tênis e relógios com preço de outlet",
  logoUrl: "",
  faviconUrl: "",
  accent: "#FFD400",
  contactEmail: "contato@example.com",
  contactPhone: "",
  address: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  about: "Outlet 3K: camisas, calças, tênis, blusas e jaquetas, relógios e mais, com preço de outlet.",
  privacyPolicy: "Tratamos seus dados conforme a LGPD. Para exercer seus direitos, acesse Minha conta > Privacidade.",
  termsPolicy: "Termos de uso da loja.",
  exchangePolicy: "Trocas e devoluções em até 7 dias após o recebimento (CDC).",
  seoTitle: "Outlet 3K — Camisas, calças, tênis, jaquetas e relógios",
  seoDescription: "Outlet 3K: camisas, calças, tênis, blusas e jaquetas e relógios com preço de outlet.",
  promoBar: [],
  homeSections: { featured: "Destaques", news: "Lançamentos", bestSellers: "Mais vendidos", sale: "Ofertas" },
  shipping: DEFAULT_SHIPPING,
};

export const getSettings = memoPerRequest(async (): Promise<StoreSettings> => {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...(map as Partial<StoreSettings>) };
});

export async function saveSettings(patch: Partial<StoreSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    });
  }
}
