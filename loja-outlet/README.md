# Outlet 3K — loja virtual (Next.js + PostgreSQL)

Loja virtual completa de roupas/streetwear com painel administrativo. Identidade preto/grafite com destaque amarelo
(cor configurável no painel). Idioma pt-BR, moeda BRL.

> **Estado do projeto:** código, banco, testes e deploy (Vercel + Supabase) funcionando. Mercado Pago e e-mail de recuperação de senha
> dependem de credenciais do proprietário (veja [Pendências](#pendências)). A referência visual do vídeo não foi analisada
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

## Gerenciamento pelo painel (sem mexer em código ou banco)
- **Produtos** (`/admin/produtos`): cadastrar, editar, duplicar e excluir (produto já vendido é só arquivado, para preservar pedidos). Campos: nome, descrição,
  preço, preço promocional (selo e preço riscado automáticos), categoria, destaque, novidade, marca, SKU e **situação**: *Ativo* (aparece e compra), *Inativo*
  (some da loja), *Indisponível* (aparece, mas não compra). O endereço (URL) do produto não muda ao renomear.
- **Fotos**: escolher no computador/celular ou arrastar e soltar; prévia antes de salvar; barra de progresso; trocar, remover e reordenar (a 1ª é a principal).
  JPG, PNG ou WebP até 4 MB. O tipo é conferido pelo **conteúdo** do arquivo (não pela extensão) no servidor.
- **Banners** (`/admin/banners`): carrossel principal e faixa de banners menores; imagem do computador e imagem opcional do celular; link, texto, ordem,
  exibir em *computador / celular / ambos*, ativar/desativar e excluir (com confirmação). Sem banner ativo, a loja mostra 3 slides padrão.
- Tudo grava no **mesmo banco** que a loja lê (páginas sempre dinâmicas): salvar no painel reflete na loja imediatamente.

### Catálogo inicial (demonstração)
`Admin → Produtos → Instalar catálogo inicial` cadastra **35 produtos de exemplo** (8 camisas, 8 calças, 8 tênis, 8 blusas e jaquetas, 3 relógios) com
nomes genéricos (sem marcas), descrições, preços em R$, tamanhos, 1 cor, estoque e **uma foto própria por produto**. É idempotente: pode ser repetido sem duplicar
(SKU `OUT3K-...`) e **não sobrescreve** o que você editar. Os produtos aparecem no painel com o selo "Exemplo". Fotos e produtos são **ilustrativos**
(veja `catalog/CREDITS.md`): troque tudo pelos reais, ou use *Colocar todos como Inativos* / *Remover catálogo inicial* antes de vender.
Também via terminal: `SEED_CATALOG=1 npm run db:seed`. As fotos ficam em `public/catalogo/` (empacotadas com o deploy); ao instalar pelo painel elas são
enviadas ao armazenamento de imagens configurado (Supabase) e passam a seguir o mesmo ciclo de qualquer foto enviada por você.

### Tamanhos de imagem recomendados
| Uso | Tamanho | Proporção |
|---|---|---|
| Carrossel (computador) | 1920×800 | ~2,4:1 (altura fixa 560 px no PC e 420 px no celular; `object-fit: cover`) |
| Carrossel (celular, opcional) | 900×1100 | 9:11 |
| Banner menor | 1600×1000 | 16:10 |
| Foto de produto | 900×1200 | 3:4 |
| Categoria | 800×600 | 4:3 |
| Logo / favicon | altura 72 px (PNG) / 512×512 | — |

### Armazenamento das imagens
- **Produção**: Supabase Storage (bucket **público**; nome em `SUPABASE_BUCKET`). Envio só pelo servidor com a chave secreta (aceita `sb_secret_...` e a antiga `service_role`).
- **Desenvolvimento/testes**: `STORAGE_DRIVER=local` grava em `.uploads/` e serve em `/uploads/...`. **Nunca** configure isso na Vercel (o disco da função é temporário).

## Vitrine (estilo marketplace de moda masculina)
Barra de avisos (editável em **Configurações**), menu com departamentos e submenus, busca com sugestões, favoritos (salvos no navegador do cliente), vitrines de Lançamentos/Destaques/Mais vendidos/Ofertas, atalhos por tamanho, listagem com filtros (categoria, tamanho, cor, preço), ordenação e paginação, página de produto com cor/tamanho, simulador de frete e aviso "Adicionado à sacola", e newsletter com consentimento (LGPD). Os e-mails da newsletter aparecem em **Clientes** e podem ser exportados em CSV.

## Pagamentos (pronto para ligar depois)
Toda a estrutura já existe; **nenhum recebedor, chave PIX ou credencial está configurado**. Em **Configurações → Pagamentos** (`/admin/config/pagamentos`):
- **Modo:** *Não configurado* (padrão: pedido fica aguardando e o admin confirma o recebimento manualmente), *Teste/simulação* (sem cobrança real) ou *Recebimento real*.
- **PIX** (ativar, chave, recebedor, validade), **Cartão** (crédito/débito, gateway, Public Key, Secret Key, ambiente Teste/Produção, parcelas) e **Webhook** (URL e assinatura). Segredos ficam **criptografados** (AES-256-GCM, chave derivada de `AUTH_SECRET` ou `PAYMENTS_ENCRYPTION_KEY`), nunca voltam para a tela e a auditoria registra só *que* mudaram.
- **Checkout em etapas:** Identificação → Entrega → Pagamento → Revisão → Pedido criado → Pagamento → Confirmação. Frete, totais e valor do pagamento são sempre calculados no servidor.
- **Status do pagamento:** Aguardando, Processando, Aprovado, Recusado, Cancelado, Estornado, Expirado — o pedido acompanha (aprovado = pago; expirado/cancelado = cancelado e estoque devolvido; estornado = reembolsado; recusado = continua aguardando e permite nova tentativa). Mudanças passam por uma única função (`lib/payments/service.ts`) com máquina de estados, idempotência e conferência do valor.
- **Modo de teste:** PIX simulado (código "TESTE-SIMULADO-NAO-PAGAVEL…") e cartões de teste; um painel simula aprovado, recusado, pendente, expirado, cancelado e estorno. Tudo marcado como **TESTE**. O cartão é "tokenizado" no navegador: o servidor recebe só token, bandeira e 4 últimos dígitos (nunca número/CVV).
- **Ligar o recebimento real:** escolha o gateway, informe as credenciais, cadastre o webhook (`/api/webhooks/mercadopago` ou `/api/webhooks/payments/<gateway>`) e mude o modo para *Recebimento real*. Hoje só o adaptador do Mercado Pago está instalado; outros gateways entram como novos adaptadores sem mexer em checkout, banco ou pedidos.
- **Importante:** deixe o modo *Teste* desligado na loja aberta ao público.

## Desempenho
- Configurações da loja e menu de categorias ficam em cache curto (5 min / 1 min) e são limpos na hora quando o painel salva algo (`lib/cache.ts`, `bustStore`).
- O cabeçalho consulta tudo em paralelo e lê o login só do cookie assinado; a página do produto faz 1 consulta (join) e carrega "relacionados" depois (Suspense). Fontes são hospedadas pelo próprio site.
- Para a loja responder mais rápido na Vercel, deixe a **região das funções** perto do banco: Vercel → Settings → Functions → Function Region (use a mesma região do projeto no Supabase; para São Paulo, `gru1`).
- Diagnóstico: `PRISMA_QUERY_LOG=1` mostra cada consulta SQL no log do servidor.

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
npm run build && STORAGE_DRIVER=local npx next start -p 3100 &  # servidor de teste
npx playwright test                       # E2E com arquivos reais: produto/upload/banners, loja, permissões, responsividade (320–1440 px)
```
O E2E espera o catálogo inicial (`SEED_CATALOG=1 npm run db:seed`) e o admin `admin@teste.local` (veja `.github/workflows/loja-outlet-ci.yml`). Use **apenas banco de teste**.

## Deploy (Vercel + Supabase)
1. **Banco**: crie um projeto Supabase (ou Neon). `DATABASE_URL` = string do *pooler* (transaction, porta 6543, `?pgbouncer=true`); `DIRECT_URL` = conexão direta (5432).
2. **Storage**: no Supabase, crie o bucket **público** `loja`. Use `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (somente servidor; nunca `NEXT_PUBLIC_`).
3. **Migrations** (manual, nunca automáticas em produção). Sem terminal, no **Editor SQL** do Supabase: banco **novo** → rode `supabase-schema.sql` (já inclui tudo); banco que **já tinha** a versão inicial → rode `supabase-update-001.sql` (status "Indisponível" e banners com imagem de celular). Com terminal: `DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy` e `npm run db:seed`.
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


Outlet 3k


Outlet 3K
