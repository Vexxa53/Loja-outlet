import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SetupForm } from "./SetupForm";

export const metadata = { title: "Instalação", robots: { index: false, follow: false } };

export default async function Page() {
  // some da internet depois do primeiro admin ou se SETUP_TOKEN não estiver configurado
  if (!process.env.SETUP_TOKEN || (await db.adminUser.count()) > 0) notFound();
  return <SetupForm />;
}
