# Configurar o Supabase

Ações manuais que **só você** pode fazer (precisam da sua conta). Nenhuma chave real está no repositório.

## 1. Criar o projeto

1. Acesse <https://supabase.com/dashboard> → **New project**.
2. Escolha organização, nome, **região próxima dos clientes** (ex.: *South America (São Paulo)*) e uma senha forte para o banco (guarde em um gerenciador de senhas).
3. Aguarde o projeto ficar “Healthy”.

## 2. Pegar as chaves

**Project Settings → API** (ou *API Keys*):

| Valor | Vai para | Observação |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | pública |
| Chave `anon` / *publishable* | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | pública (protegida por RLS) |
| Chave `service_role` / *secret* | `SUPABASE_SERVICE_ROLE_KEY` | **SECRETA** — só no servidor/Vercel. Nunca em `NEXT_PUBLIC_*`, nunca no Git. |

> Se o painel do Supabase mostrar o formato novo de chaves (publishable/secret), use a *publishable* em
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` e a *secret* em `SUPABASE_SERVICE_ROLE_KEY`; o código não muda.

## 3. Executar as migrações (nesta ordem)

Em **SQL Editor → New query**, cole e execute cada arquivo de `supabase/migrations/`:

1. `0001_core_schema.sql`
2. `0002_rls_and_grants.sql`
3. `0003_business_functions.sql`
4. `0004_storage.sql`  (cria o bucket `store-media` e as políticas de Storage)

Ou, com a CLI do Supabase: `supabase link --project-ref <ref>` e `supabase db push`.

Confira em **Table Editor** que todas as tabelas mostram **RLS enabled** e em **Storage** que existe o bucket `store-media` (público, limite 4 MB, JPEG/PNG/WebP).

## 4. Autenticação

**Authentication → Providers → Email**: mantenha *Email* ligado. Recomendado:

- Desligue **“Allow new users to sign up”** (cadastro aberto) — os lojistas são criados pelo master/convite.
- Mantenha a confirmação de e-mail ligada.

**Authentication → URL Configuration:**

- **Site URL:** a URL pública do app (ex.: `https://sites.vexxa360.com.br`)
- **Redirect URLs:** `https://SEU-DOMINIO/auth/callback`, `https://SEU-DOMINIO/**` e, para testes locais, `http://localhost:3000/**`
  (e o domínio `*.vercel.app` das previews, se for usar).

**E-mail:** o SMTP padrão do Supabase tem limite baixo de envios e é só para testes. Para produção configure um SMTP próprio
(Authentication → SMTP Settings). *Valores/limites: verificar na documentação atual.*

## 5. Criar o primeiro administrador (master) com segurança

Não existem usuários nem senhas padrão. O primeiro administrador da plataforma é você:

1. **Authentication → Users → Add user → Create new user**: informe **seu e-mail** e uma **senha forte e única**
   (marque *Auto Confirm User*).
2. No **SQL Editor**, torne esse usuário administrador da plataforma:

   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'SEU-EMAIL@exemplo.com';
   ```

   Essa é a **única** forma de criar um master (a tabela não aceita escrita pela API). Faça só para pessoas de confiança.
3. Entre em `https://SEU-DOMINIO/login` → abra **/master** → **Nova loja** (nome, identificador na URL, e-mail do lojista).
   Se o e-mail do lojista ainda não tiver conta, o Supabase envia um convite para ele definir a senha.

## 6. Mais usuários por loja (equipe)

Por segurança não há tela para o lojista conceder papéis. Para adicionar alguém da equipe, crie o usuário em
*Authentication → Users* e vincule por SQL:

```sql
insert into public.memberships (tenant_id, user_id, role)
select t.id, u.id, 'staff'            -- 'owner' | 'admin' | 'staff'
from public.tenants t, auth.users u
where t.slug = 'slug-da-loja' and u.email = 'pessoa@exemplo.com';
```

| Papel | Pode |
|---|---|
| `owner` / `admin` | tudo da loja: produtos, custo, preços, promoções, banners, configurações, personalização, pedidos, estoque |
| `staff` | produtos (sem custo), categorias, estoque e pedidos; **não** altera configurações, promoções, banners nem vê custo |

## 7. Backups

Planos pagos têm backups automáticos; no gratuito, exporte periodicamente (`pg_dump`) e as imagens do bucket.
*Verifique a política atual de backup do seu plano.*
