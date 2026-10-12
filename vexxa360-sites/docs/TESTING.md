# Testes — o que foi verificado de verdade (e o que não foi)

## Camadas

| Camada | Arquivos | Roda com | O que prova |
|---|---|---|---|
| Unitários | `tests/unit` | `npm run test:unit` | dinheiro/centavos, slug, mensagem do WhatsApp, validação de upload (bytes), schemas zod (produto, loja, promoção, checkout), open-redirect, rate limit |
| Banco | `tests/db` | `TEST_DATABASE_URL=… npm run test:db` | migrações do zero; **isolamento RLS**; privilégios por coluna; Storage policies; preço/promoção (futura, no ar, expirada); pedidos; snapshot imutável; **concorrência**; status/estoque/reservas |
| E2E | `tests/e2e` | `tests/e2e/run.sh` | o app em **modo produção** num navegador real (Chromium/Playwright) contra uma pilha **Supabase de verdade** (Postgres, GoTrue, PostgREST, Storage e Mailpit em contêineres) |

### E2E: como roda

`tests/e2e/stack/` tem um `docker-compose.yml` com as imagens oficiais do Supabase (`supabase/postgres`, `supabase/gotrue`, `supabase/storage-api`,
`postgrest/postgrest`) + um nginx no lugar do Kong. `reset.sh` recria o banco e **reaplica todas as migrações de `supabase/migrations`** (mesmo caminho de um deploy novo).
`run.sh` faz: reset → `next build` → `next start` → Playwright. Primeira vez:

```bash
cd tests/e2e/stack && node gen-env.mjs                    # gera chaves JWT de TESTE (.env local, ignorado pelo Git)
docker compose --env-file .env up -d
docker compose --env-file .env exec -T db psql -U supabase_admin -d postgres -f - < roles.sql
cd ../../.. && cp tests/e2e/stack/.env /tmp/e2e.env       # (opcional) e crie .env.local apontando para http://127.0.0.1:54321 com as chaves do .env
tests/e2e/run.sh
```

(`.env.local` do app para o E2E: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY`,
`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100`, `SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY`.)

## Cobertura dos testes obrigatórios

| Pedido | Onde |
|---|---|
| Login e logout · recuperação de senha | E2E (e-mail real capturado no Mailpit; senha antiga deixa de valer; link é de uso único) |
| Criação / edição / duplicação / arquivamento / exclusão de produto | E2E |
| Upload de imagem (válida e inválida) | E2E (arquivos reais no Storage; “.jpg” com PHP é recusado) + unitários |
| Criação de categoria | E2E (inclui nome repetido) |
| Publicação e despublicação (produto e loja) | E2E |
| Criação e expiração de promoção · cálculo de preços | E2E + banco (futura/ativa/expirada, % / R$ / preço fixo, melhor oferta) |
| Estoque por tamanho e cor · nunca negativo · movimentações | E2E + banco |
| Pedido pelo WhatsApp · persistência · histórico de preços | E2E + banco (mensagem, snapshot, preço imutável após mudar o produto) |
| Atualização de status · cancelamento devolve estoque · reservas expiradas | E2E + banco |
| **Isolamento entre lojas** | E2E (UI com IDs trocados → 404; API com o JWT do lojista B: leitura vazia, escrita 0 linhas/403, RPC “não encontrado”, Storage 4xx) + banco |
| Permissões do painel (owner/staff) · acesso não autenticado | E2E |
| Validação no servidor (preço, estoque, telefone, URL, destino de banner) | E2E + unitários |
| Concorrência (última unidade; numeração de pedidos) | banco (15 e 20 requisições simultâneas) |
| Layout mobile (390 px, sem rolagem horizontal) | E2E + capturas em `tests/e2e/screens/` |
| Segredos não expostos · cabeçalhos · robots/sitemap | E2E (varredura de `.next/static` e HTML) |
| Build de produção | `next build` (usado pelo `run.sh`) |
| **Deploy** | **NÃO executado** — depende da sua conta Vercel/Supabase (`DEPLOY-VERCEL.md`) |

## O que **não** foi testado (limites honestos)

- **Deploy real na Vercel** e Supabase hospedado: validado só em pilha local equivalente. Diferenças possíveis: SMTP, limites de plano, CDN, versões.
- **Envio efetivo no WhatsApp**: o app gera o link `wa.me` com a mensagem correta e abre; que o cliente toque em “enviar” é fora do sistema.
- **Safari/Firefox e celulares reais**: só Chromium com viewport móvel.
- **Carga/desempenho** sob tráfego real e limitador de tentativas distribuído.
- **Acessibilidade** formal (leitor de tela, auditoria WCAG): há rótulos, foco e `aria-*`, mas sem auditoria.
- **Domínio próprio por cliente**: não implementado (só a estrutura de dados).
- Ações do painel invocadas com **IDs forjados diretamente nas Server Actions** não têm teste de navegador; a proteção é do desenho (todas filtram por `tenant_id` da sessão) e do banco (RLS + FKs compostas), ambos testados.
