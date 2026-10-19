-- Atualização 002 (para quem JÁ rodou supabase-schema.sql e supabase-update-001.sql): cadastro de e-mail (newsletter).
-- Rode UMA vez no SQL Editor do Supabase.
-- CreateTable
CREATE TABLE "NewsletterSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'site',
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSignup_email_key" ON "NewsletterSignup"("email");

-- Segurança: bloqueia o acesso público (API do Supabase) à tabela nova
ALTER TABLE "NewsletterSignup" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "NewsletterSignup" FROM anon, authenticated;
