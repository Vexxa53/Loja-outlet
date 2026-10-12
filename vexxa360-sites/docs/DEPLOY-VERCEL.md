# Deploy na Vercel

> **Status:** o deploy **não foi executado** a partir deste ambiente (sem acesso à sua conta Vercel/Supabase).
> O build de produção (`next build`) e o fluxo completo foram validados localmente — veja `TESTING.md`.
> Este guia é o roteiro para você executar e validar.

## Pré-requisitos

- Projeto Supabase pronto, com migrações aplicadas e primeiro master criado (`SETUP-SUPABASE.md`).
- Repositório no GitHub contendo esta pasta.

## Passo a passo

1. **Instalar e rodar local (opcional, recomendado):** `cd vexxa360-sites && npm install && npm run build`.
2. **Importar na Vercel:** *Add New → Project* → escolha o repositório.
   - **Root Directory:** `vexxa360-sites`  (o repositório também contém o projeto TemperoTop na raiz).
   - Framework: Next.js (detectado). Build/Install: padrões.
3. **Variáveis de ambiente** (*Settings → Environment Variables*, para Production e Preview):

   | Nome | Valor | Tipo |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto | pública |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon/publishable | pública |
   | `NEXT_PUBLIC_SITE_URL` | `https://SEU-DOMINIO` (sem `/` no fim) | pública |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave service_role/secret | **secreta** (não marque como pública) |

4. **Deploy.** Aguarde o build. Anote a URL (`https://….vercel.app`).
5. **URLs autorizadas no Supabase** (*Authentication → URL Configuration*): inclua `https://SEU-DOMINIO/auth/callback`,
   `https://SEU-DOMINIO/**` e o domínio `*.vercel.app`. Sem isso o link de “esqueci minha senha” e de convite não funciona.
6. **Domínio:** *Settings → Domains* → adicione o domínio e siga as instruções de DNS. Atualize `NEXT_PUBLIC_SITE_URL` e as URLs do passo 5 e faça novo deploy.
7. **Domínio próprio por cliente:** a estrutura de dados existe (`tenant_domains`, `resolve_tenant_slug`), mas o roteamento por host
   **ainda não está implementado**. Cada loja funciona em `https://SEU-DOMINIO/loja/<slug>`. Para domínio próprio será preciso:
   adicionar o domínio no projeto Vercel, apontar o DNS do cliente e implementar o rewrite por hostname no `proxy.ts`.
   Não prometa isso ao cliente antes de concluir essa etapa.

## Testes pós-deploy (faça nesta ordem)

- [ ] `https://SEU-DOMINIO/login` carrega; `/admin` sem login redireciona para `/login`.
- [ ] Login do master → `/master` → criar uma loja de teste vinculada a um e-mail seu.
- [ ] “Esqueci minha senha” → o e-mail chega → o link abre `/auth/redefinir` → nova senha → entra no painel.
- [ ] No painel: **Configurações** (WhatsApp, publicar), **Personalização** (logo), **Categorias**, **Novo produto** com 2 fotos.
- [ ] No Supabase → Storage → `store-media`: os arquivos aparecem em `<id-da-loja>/products/…` (persistência fora da Vercel).
- [ ] `https://SEU-DOMINIO/loja/<slug>` mostra produto, preço e fotos; faça um pedido de teste e abra o WhatsApp.
- [ ] `/admin/pedidos` mostra o pedido “Novo”; mude para “Confirmado”; o estoque foi reservado em **Estoque**.
- [ ] Recarregue tudo / faça um novo deploy: os dados continuam.
- [ ] Crie uma 2ª loja com outro e-mail e confirme que um lojista **não** vê dados do outro.
- [ ] Inspecione o código-fonte da página/JS no navegador: a chave `service_role` **não** aparece em lugar nenhum.
- [ ] `https://SEU-DOMINIO/sitemap.xml` e `/robots.txt` respondem.

## Observações

- **Limite de corpo da Vercel (~4,5 MB por requisição):** por isso o upload é feito foto a foto e o navegador reduz a imagem antes (máx. 4 MB aceitos).
- **Cache:** as páginas públicas são renderizadas dinamicamente (preço, estoque e publicação sempre atuais). Se o tráfego crescer,
  dá para introduzir cache com revalidação por tag — **não** cacheie preço/estoque sem invalidação.
- **Limitador de tentativas** (login e pedidos) é em memória por instância: reduz abuso casual, mas em serverless não é global.
  Para proteção forte use o *Firewall/WAF* da Vercel ou um limitador distribuído (ex.: Upstash).
- **Reservas de estoque expiradas** são liberadas pelo botão em *Pedidos*. Para automatizar, agende (pg_cron/Vercel Cron) uma chamada a
  `_cancel_order()` para pedidos `new` antigos — hoje não existe job automático.
