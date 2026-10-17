-- Rode UMA vez no SQL Editor do Supabase, depois de supabase-schema.sql (e depois de qualquer nova migration que crie tabelas).
-- Bloqueia o acesso público pela API do Supabase (chaves anon/publishable) a todas as tabelas.
-- A aplicação acessa o banco por conexão direta (role postgres, que ignora RLS), então nada muda para a loja.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
