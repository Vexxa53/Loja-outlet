import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";

const MAP = { privacidade: ["Política de privacidade", "privacyPolicy"], trocas: ["Trocas e devoluções", "exchangePolicy"], termos: ["Termos de uso", "termsPolicy"] } as const;

export default async function Policy({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = MAP[slug as keyof typeof MAP];
  if (!entry) notFound();
  const s = await getSettings();
  return (<div className="container-x max-w-3xl py-10"><h1 className="h-display text-3xl">{entry[0]}</h1><div className="mt-6 whitespace-pre-line leading-relaxed text-zinc-300">{s[entry[1]]}</div></div>);
}
