# Segurança

Defesa em camadas: **proxy (UX) → autorização no servidor → RLS/privilégios no banco**. Se uma camada falhar, a seguinte segura.

## Isolamento entre lojas

| Camada | Como |
|---|---|
| Esquema | `tenant_id` em todo registro de loja; FKs **compostas** `(tenant_id, id)` (produto↔categoria, variação↔produto, item↔pedido…). Mesmo o superusuário não consegue vincular registros de lojas diferentes. |
| RLS | Habilitado em **todas** as tabelas. Funções `has_tenant_role()` / `is_tenant_member()` leem `memberships` com `auth.uid()`. Tudo é negado por padrão (`revoke all` antes dos `grant`s mínimos). |
| Servidor | `lib/auth/context.ts`: sessão validada com `auth.getUser()` (valida o JWT no Supabase) → loja ativa conferida contra os vínculos reais → papel. O cookie `vx_tenant` só **escolhe** entre lojas que o usuário já tem. Toda consulta do painel filtra `.eq("tenant_id", ctx.tenantId)`; o `id` vindo da URL/formulário nunca é confiado sozinho. |
| Funções | `change_order_status`, `adjust_stock`, `set_stock`, `dashboard_stats`, `release_expired_reservations` são `SECURITY DEFINER` com checagem explícita de papel e respondem igual a “não existe” e “é de outra loja” (não vaza existência). |
| Storage | Bucket `store-media`: leitura pública (só mídia de vitrine); escrita só para quem tem papel na loja **dona da pasta** (`<tenant_id>/…`). Caminho gerado no servidor. |

> Atenção para quem mexer no código: como a vitrine é pública, usuários logados também **leem** produtos publicados de qualquer loja.
> Por isso o painel **sempre** filtra por `tenant_id` — confiar só no RLS faria listas misturarem a vitrine de outras lojas.

## Privilégios por coluna (o que a vitrine não vê)

- **Custo de aquisição**: tabela própria `product_costs` (somente `owner`/`admin`). Não existe coluna de custo em `products`.
- `store_settings`: visitante só recebe as colunas públicas; `low_stock_threshold`/`reservation_hours` são internas.
- **Estoque** (`stock_quantity`), **status/valores de pedido**, itens e histórico: nenhum `UPDATE` direto para usuários. Só pelas funções do banco, que registram auditoria.
- **Papéis**: `memberships`, `platform_admins`, `tenants`: usuários só leem. Ninguém altera o próprio papel; master é inserido por SQL.
- `profiles`: o usuário só edita o próprio **nome** (não e-mail nem id).

## Pedidos

`place_order()` roda só com `service_role` (revogada para `anon`/`authenticated`): valida loja publicada, item publicado/ativo da **mesma loja**, quantidade 1–50,
**recalcula o preço no banco**, trava a variação (`FOR UPDATE`) e baixa o estoque com `UPDATE … WHERE stock_quantity >= qtd` — duas compras da última unidade
nunca passam (testado com 15 compras simultâneas). O navegador não envia preço, total nem tenant.

## Segredos

- `SUPABASE_SERVICE_ROLE_KEY` é lida apenas em `lib/supabase/admin.ts` (`import "server-only"`: o build falha se algum componente de cliente importar).
  Usada em 2 lugares: `place_order` e painel master (depois de `is_platform_admin()`).
- Teste automatizado procura a chave nos bundles/HTML gerados (`flow.spec.ts › segredos não vazam`).
- `.env*` está no `.gitignore`; só `.env.example` (sem valores) é versionado.

## Entrada, XSS e injeção

- Toda entrada passa por **zod** (tamanhos, formatos, URLs só `https`, cores `#RRGGBB`, destino de banner interno ou `https`).
  Cores do lojista entram em CSS variável **depois** de validadas por regex (sem injeção de CSS).
- React escapa texto por padrão; só há um `dangerouslySetInnerHTML` (JSON-LD), com `<` escapado.
- Consultas via PostgREST/SQL parametrizado (nenhuma concatenação de SQL). Busca escapa `% _ \`.
- Upload: tamanho ≤ 4 MB e **formato conferido pelos bytes** (JPEG/PNG/WebP); SVG/HTML/PHP disfarçados são recusados; bucket também restringe MIME.
- Open redirect: `safeNext()` só aceita caminhos internos.
- Cabeçalhos: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removido.

## Autenticação

Supabase Auth (senha com hash, JWT curto + refresh). Mensagem de erro única no login (“E-mail ou senha incorretos”); recuperação de senha responde igual
para e-mail existente ou não; link de recuperação é de uso único. Limite de tentativas por IP/e-mail (só falhas contam).

## Auditoria

`audit_log` registra quem/quando/qual entidade (inserir/alterar/excluir) em produtos, configurações, promoções, categorias, banners, vínculos e lojas, e
`order_status_history` + `inventory_movements` registram pedidos e estoque. Visível só para `owner`/`admin` (e master). Não grava conteúdo sensível.

## Limitações conhecidas (seja transparente com o cliente)

1. **Rate limit em memória**: não é global em serverless (veja `DEPLOY-VERCEL.md`). Use WAF/Upstash para proteção forte.
2. **Sem CAPTCHA** no checkout: alguém pode criar pedidos falsos (reservam estoque até expirar). Mitigações: limite por IP/telefone, expiração de reservas, pedido não é “venda”.
3. **Sem 2FA** no painel (depende de configurar MFA no Supabase).
4. **Imagens públicas**: qualquer pessoa com a URL vê. Não envie nada privado para `store-media`.
5. Bucket público: o limite de 4 MB e os tipos permitidos são aplicados também pelo bucket, mas **não há antivírus**.
6. Falta política de **retenção/LGPD** para dados de clientes dos pedidos (nome/telefone). Defina prazo e rotina de anonimização com o jurídico.
