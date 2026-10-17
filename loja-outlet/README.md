# Loja Outlet — streetwear (Next.js + PostgreSQL)

Loja virtual completa de roupas/streetwear com painel administrativo. Identidade preto/grafite com destaque amarelo
(cor configurável no painel). Idioma pt-BR, moeda BRL.

> **Estado honesto do projeto:** o código, o banco (migrations), os testes e a configuração de deploy estão prontos e foram
> testados localmente com PostgreSQL 16. **Não foi publicado** na Vercel nem ligado a Supabase/Mercado Pago reais — isso exige
> credenciais/autorizações do proprietário (veja [Pendências](#pendências)). A referência visual do vídeo não foi analisada
> (o arquivo não estava disponível); o layout segue a descrição textual do briefing.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6 · Zod · Recharts · Vitest · Playwright.
Autenticação própria (bcrypt + JWT HS256 em cookie `httpOnly`), upload de imagens no Supabase Storage (REST), pagamentos via Mercado Pago (Checkout Pro).

## Estrutura
```
app/(loja)/        loja pública (home, catálogo, produto, carrinho, checkout, pedido, conta, políticas)
app/admin/         painel (login + (panel)/ dashboard, produtos, categorias, estoque, pedidos, clientes, cupons, banners, config, usuários, auditoria)
app/actions/       server actions (toda ação administrativa chama requireAdmin(permissão) no servidor)
app/api/           webhook Mercado Pago, export CSV, cron de expiração de pedidos
lib/               regras de negócio: pricing (preço/cupom/frete), orders (transação de pedido), stock, cart, payments, storage, auth, audit
prisma/            schema, migrations versionadas, seed
scripts/           create-admin
tests/ e2e/        Vitest (unitário + integração com PostgreSQL) e Playwright
```

## Rodando localmente
```bash
cp .env.example .env        # preencha DATABASE_URL, DIRECT_URL, AUTH_SECRET (openssl rand -base64 48), BASE_URL
npm install
npx prisma migrate dev      # cria as tabelas
npm run db:seed             # cria perfis padrão (SEED_DEMO=1 npm run db:seed → também dados de DEMONSTRAÇÃO)
ADMIN_EMAIL=voce@dominio.com ADMIN_NAME="Seu Nome" npm run admin:create   # pede a senha no terminal
npm run dev                 # http://localhost:3000  ·  painel: /admin
```

## Criação segura do primeiro administrador (via navegador — recomendado)
1. Defina `SETUP_TOKEN` (texto aleatório de 20+ caracteres) nas variáveis de ambiente da Vercel e faça o deploy.
2. Abra `https://SEU-DOMINIO/admin/setup`, informe o `SETUP_TOKEN`, seu nome, e-mail e senha.
3. A página só existe enquanto não houver administrador (depois responde 404). Remova `SETUP_TOKEN` da Vercel depois de usar.

### Alternativa pelo terminal
Não há senha padrão nem cadastro público de admin. Pelo terminal, o primeiro administrador é criado **somente por quem tem acesso ao banco**,
rodando `npm run admin:create` com `DATABASE_URL` do ambiente desejado (a senha é digitada no terminal, sem eco, ≥10 caracteres,
letras e números, e nunca é gravada em arquivo). Depois, o admin cria os demais usuários em **Admin → Usuários**.

## Perfis e permissões
Administrador principal (fixo, todas), Gestor da loja, Gestor de produtos, Estoquista, Atendimento, Operador de pedidos e Analista.
As permissões por perfil são editáveis em Admin → Usuários. A verificação é feita **no servidor** (`requireAdmin(perm)` em cada página/ação/rota);
quem não tem a permissão é redirecionado para `/admin/sem-permissao`.

## Segurança (resumo)
- Senhas com bcrypt (custo 12); sessão JWT em cookie `httpOnly`, `sameSite=lax`, `secure` em produção; admin expira em 8 h.
- Rate limit em login (cliente/admin), cadastro, recuperação de senha, cupom e checkout (tabela `RateLimit`, funciona em serverless).
- Preços, promoções, cupons, frete e estoque são **sempre recalculados no servidor**; pedido grava snapshot (nome, SKU, variação, preço).
- Estoque: `UPDATE … WHERE stock + delta >= 0` atômico dentro de transação (testado com compras concorrentes); cupom com `FOR UPDATE`.
- Webhook Mercado Pago: valida `x-signature` (HMAC) com `MP_WEBHOOK_SECRET`, consulta o pagamento na API, confere o valor e é idempotente (`PaymentEvent` único).
- Upload: valida tipo por *magic bytes* e tamanho (4 MB), nome de arquivo gerado (UUID).
- CSV com neutralização de injeção de fórmulas; auditoria sem senhas/tokens; cabeçalhos de segurança básicos.
- LGPD: solicitações de acesso/correção/exclusão na conta do cliente; a exclusão **anonimiza** (admin confirma) preservando valores financeiros dos pedidos.

## Testes
```bash
npm run typecheck && npm run lint
npm test                                  # unitários (sempre) 
INTEGRATION=1 npm test                    # + integração com PostgreSQL (cria/limpa dados ITEST-*)
npm run build && npx playwright test      # E2E (loja, conta, isolamento de dados, admin, permissões, mobile)
```
O E2E espera o seed de demonstração e o admin `admin@teste.local` (veja `.github/workflows/loja-outlet-ci.yml`). Use **apenas banco de teste**.

## Deploy (Vercel + Supabase)
1. **Banco**: crie um projeto Supabase (ou Neon). `DATABASE_URL` = string do *pooler* (transaction, porta 6543, `?pgbouncer=true`); `DIRECT_URL` = conexão direta (5432).
2. **Storage**: no Supabase, crie o bucket **público** `loja`. Use `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (somente servidor; nunca `NEXT_PUBLIC_`).
3. **Migrations** (manual, nunca automáticas em produção). Sem terminal: cole o conteúdo de `supabase-schema.sql` no **Editor SQL** do Supabase e execute (somente na criação inicial). Com terminal: `DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy` e `npm run db:seed`.
3b. **Segurança (obrigatório no Supabase)**: rode `supabase-security.sql` no SQL Editor — ele ativa RLS e remove o acesso das chaves públicas às tabelas (sem isso, dados de clientes ficam expostos pela API REST do Supabase). Repita após criar novas tabelas.
4. **Vercel**: *Add New Project* → repositório → **Root Directory = `loja-outlet`**. Variáveis: ver `.env.example`
   (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `BASE_URL`, `SUPABASE_*`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `CRON_SECRET`).
5. **Mercado Pago**: configure o webhook `https://SEU-DOMINIO/api/webhooks/mercadopago` (evento *Pagamentos*) e copie a assinatura secreta para `MP_WEBHOOK_SECRET`. Teste com credenciais de teste antes de produção.
6. `vercel.json` já agenda o cron diário que cancela pedidos não pagos há 48 h e repõe o estoque.
7. Crie o administrador (seção acima) apontando para o banco de produção.

## Backup e recuperação
Delegados ao provedor do banco: confirme no plano contratado (Supabase Free **não** inclui backups diários; planos pagos incluem). Recomendado:
`pg_dump "$DIRECT_URL" -Fc -f backup.dump` agendado + cópia fora do provedor; restauração com `pg_restore -d "$DIRECT_URL" backup.dump`. Backups contêm dados pessoais — não os versione.

## Regras de negócio relevantes
- Frete: tabela própria por região do CEP (editável em Configurações) com frete grátis acima de um valor. **Não** há integração com transportadoras (Correios/Melhor Envio).
- Pagamento recusado não cancela o pedido (o cliente pode tentar de novo); pedido sem pagamento expira em 48 h (cron). Se um pagamento for aprovado depois da expiração, o pedido recebe um aviso "ATENCAO" no histórico para reembolso/reprocessamento manual. Cancelar/reembolsar antes do envio repõe estoque uma única vez; reembolso financeiro é feito no painel do Mercado Pago.
- "Mais vendidos" usa somente pedidos pagos reais; sem vendas, a seção não aparece.

## Pendências
- Publicação na Vercel, projeto Supabase (banco + bucket), credenciais Mercado Pago e Resend (e-mail de recuperação de senha) — dependem de autorização/credenciais do proprietário.
- Cálculo de frete por transportadora; reembolso via API; rate limit por IP depende do cabeçalho `x-forwarded-for` da plataforma.
- Otimização de imagens (hoje são servidas como enviadas, limite 4 MB) e tela de transferência de estoque em lote.
