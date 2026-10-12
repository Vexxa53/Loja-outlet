# Vexxa360° Sites

Plataforma multi-loja (multi-tenant) para vender sites profissionais de moda e varejo.
Cada lojista tem **vitrine pública**, **painel administrativo**, **estoque por tamanho/cor**, **preços e promoções agendadas**
e **pedidos pelo WhatsApp** — tudo persistido no Supabase.

- **Frontend/servidor:** Next.js 16 (App Router) · React 19 · TypeScript estrito · Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Auth + Storage), com RLS em todas as tabelas
- **Deploy:** Vercel (aplicação) + Supabase (dados e arquivos)

> Este diretório é independente do site TemperoTop que está na raiz do repositório (landing page + Mercado Pago).
> Nada daquele projeto foi alterado.

## Mapa do projeto

```
supabase/
  migrations/           0001 esquema · 0002 RLS/privilégios · 0003 regras de negócio · 0004 Storage
  tests/00_supabase_stub.sql   (só para testes locais em PostgreSQL puro)
src/
  proxy.ts              renova sessão e barra /admin e /master sem login (1ª barreira)
  lib/
    supabase/           clientes: navegador, servidor (sessão), admin (service_role, server-only)
    auth/context.ts     autorização no servidor: sessão → vínculo com a loja → papel
    actions/            Server Actions (login, produtos, estoque, promoções, pedidos, master, checkout…)
    validation/         schemas zod (entrada nunca é confiável)
    data/               consultas da vitrine e do painel
    money.ts whatsapp.ts images.ts rate-limit.ts …
  components/           ui, store (vitrine, sacola), admin (shell, formulários)
  app/
    loja/[slug]/…       vitrine pública (home, catálogo, produto, sacola)
    admin/…             painel do lojista
    master/             painel da Vexxa360° (criar/suspender lojas)
    login, auth/…       autenticação e recuperação de senha
tests/
  unit/                 funções puras e schemas (vitest)
  db/                   RLS, preços, pedidos e concorrência contra PostgreSQL (vitest)
  e2e/                  fluxo completo no navegador contra uma pilha Supabase local (Playwright)
docs/                   guias de configuração, deploy, custos, segurança e testes
```

## Como funciona (resumo da arquitetura)

| Tema | Decisão |
|---|---|
| Multi-tenant | Toda tabela de loja tem `tenant_id`; relações **compostas** `(tenant_id, id)` impedem vincular registros de lojas diferentes (até o superusuário é barrado pela FK). |
| Quem pode o quê | `memberships(tenant_id, user_id, role)` com papéis `owner`, `admin`, `staff`. Só o painel master (service role) ou SQL do projeto cria/altera vínculos — ninguém altera o próprio papel. |
| Master | Tabela `platform_admins`, sem nenhuma policy de escrita. O primeiro admin entra por SQL (veja `docs/SETUP-SUPABASE.md`). |
| Vitrine pública | Chave pública + RLS: só lojas **publicadas**, produtos **publicados** e colunas **públicas** (custo fica em `product_costs`, inacessível à vitrine). |
| Pedido | `place_order()` (PL/pgSQL, só `service_role`): recalcula preço no banco, trava a variação, baixa estoque **de forma atômica**, grava snapshot de nome/variação/preço. O navegador só envia `variant_id` + quantidade. |
| Estoque | Reserva ao criar o pedido; devolução ao cancelar; reservas “Novo” expiradas são liberadas pelo lojista. Estoque nunca negativo (CHECK + UPDATE condicional). Toda mudança gera `inventory_movements`. |
| Pagamento | **Não existe.** Pedido pelo WhatsApp nasce como “Novo” — nem pago nem confirmado. O faturamento só conta pedidos confirmados/em preparação/enviados/concluídos. |
| Preço | `effective_price()` = menor entre preço, preço promocional e promoções agendadas **dentro da vigência** (ativação/expiração automáticas, sem cron). |
| Imagens | Bucket público `store-media`; caminho gerado no servidor (`<tenant>/<pasta>/<uuid>.<ext>`), formato conferido pelos bytes, limite de 4 MB, políticas de Storage por pasta da loja. |

## Rodando localmente

Pré-requisitos: Node 20.9+ e um projeto Supabase (veja `docs/SETUP-SUPABASE.md`).

```bash
cd vexxa360-sites
npm install
cp .env.example .env.local      # preencha com as chaves do SEU projeto Supabase
npm run dev                     # http://localhost:3000
```

Variáveis (`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
e **`SUPABASE_SERVICE_ROLE_KEY`** (secreta, só no servidor).

## Testes

```bash
npm run typecheck
npm run test:unit                                   # sem dependências externas
TEST_DATABASE_URL=postgres://… npm run test:db     # PostgreSQL vazio (as migrações são aplicadas pelo teste)
tests/e2e/run.sh                                    # E2E completo (precisa de Docker) — veja docs/TESTING.md
```

## Documentação

- [Configurar o Supabase](docs/SETUP-SUPABASE.md) — projeto, migrações, Storage, primeiro administrador, URLs de autenticação
- [Deploy na Vercel](docs/DEPLOY-VERCEL.md) — passo a passo e testes pós-deploy
- [Segurança](docs/SECURITY.md) — modelo de ameaças, o que é garantido e onde
- [Custos e limites](docs/COSTS.md) — o que depende de plano pago (valores pendentes de verificação)
- [Testes](docs/TESTING.md) — o que foi testado de verdade e o que **não** foi
- [Roteiro de aceite](docs/ACCEPTANCE.md) — checklist da primeira venda

## O que NÃO está implementado (de propósito)

Pagamento online, frete calculado, cupons de desconto, avaliações de clientes, domínio próprio automatizado
(a estrutura `tenant_domains` e `resolve_tenant_slug()` existem; o roteamento por host fica para a próxima etapa),
e-mails transacionais de pedido. Nenhum deles aparece na interface como se existisse.
