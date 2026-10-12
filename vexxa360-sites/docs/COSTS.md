# Custos e limites

> **Aviso:** não tenho acesso aos preços e limites **atuais** dos serviços. Os itens marcados **[VERIFICAR]** são de memória/ordem de grandeza e
> **precisam ser conferidos** nas páginas oficiais (<https://supabase.com/pricing>, <https://vercel.com/pricing>) antes de apresentar valores ao cliente.
> Não use estes números em propostas comerciais sem conferir.

## Onde há consumo

| Recurso | O que consome | Observações |
|---|---|---|
| **Supabase — banco** | linhas de produtos, variações, pedidos, auditoria | texto é pequeno; uma loja com milhares de pedidos ainda é pouco. Plano gratuito tem teto de armazenamento do banco **[VERIFICAR]**. |
| **Supabase — Storage** | fotos de produtos, logos, banners | é o que mais cresce. O app reduz fotos no navegador (~100–600 KB cada, máx. 4 MB). 12 fotos × 200 produtos ≈ 0,5–1,5 GB. Plano gratuito tem teto **[VERIFICAR]**. |
| **Supabase — tráfego (egress)** | cada visualização de foto da vitrine sai do Storage | a Vercel também otimiza imagens (cache). Tráfego alto ⇒ plano pago/CDN. **[VERIFICAR]** limite mensal. |
| **Supabase — Auth** | usuários ativos mensais | lojistas e equipe (poucos). Clientes finais **não** têm conta. **[VERIFICAR]** |
| **Supabase — e-mail** | convite e recuperação de senha | o SMTP padrão é só para teste e tem limite baixo; produção exige SMTP próprio (custo do provedor). **[VERIFICAR]** |
| **Vercel — funções/banda** | cada página dinâmica é uma execução | vitrine é dinâmica (preço/estoque atuais). Limites de execuções, banda e otimização de imagens variam por plano **[VERIFICAR]**. |
| **Domínios** | registro anual (.com.br etc.) | custo do registrador; DNS próprio por cliente exige configuração (e adicionar o domínio na Vercel). **[VERIFICAR]** |

## Pontos de atenção para uso comercial

1. **Planos gratuitos podem ser incompatíveis com uso comercial.** Os termos da Vercel para o plano gratuito (*Hobby*) restringem uso a fins pessoais/não comerciais
   — **[VERIFICAR nos termos atuais]**; para vender sites a clientes, considere o plano pago. No Supabase, projetos gratuitos podem ser **pausados por inatividade**
   e não têm backups diários **[VERIFICAR]** — inadequado para loja em produção.
2. **Não dependa de plano gratuito** para a primeira venda a clientes pagantes. Orce, no mínimo: plano pago do Supabase (por projeto ou compartilhado entre lojas) + plano pago da Vercel + SMTP + domínio.
3. **Multi-loja em um único projeto Supabase** divide o custo entre clientes (esta arquitetura foi feita para isso), mas todos compartilham limites de banco, Storage e tráfego.
   Considere cobrar mensalidade que cubra infraestrutura + suporte, e monitorar o consumo por loja (`select tenant_id, count(*) …`).
4. **Domínio próprio por cliente**: cada domínio adicional na Vercel pode ter limites por plano **[VERIFICAR]**; o app ainda não faz roteamento por host.

## Como reduzir custo sem perder qualidade

- Mantenha o redimensionamento de imagem no navegador (já implementado) e evite fotos acima de ~1600 px.
- Use o otimizador de imagens do Next (`next/image`, já usado) para servir AVIF/WebP menores.
- Não habilite recursos pagos (Realtime, Edge Functions, add-ons) — o app não os usa.
- Mantenha poucas consultas pesadas na home (já limitadas a 4–8 itens por seção).
