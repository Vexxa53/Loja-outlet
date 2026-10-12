# Roteiro de aceite — primeira venda

Marque cada item **no ambiente real** (Supabase + Vercel) antes de entregar a loja ao cliente.
A coluna “Verificado automaticamente” indica o que já foi comprovado nos testes locais contra um Supabase real em contêineres (não substitui o teste em produção).

| # | Critério | Verificado automaticamente | No ambiente real |
|---|---|---|---|
| 1 | Criar uma loja (painel master) | ✅ E2E “master cria duas lojas” | ☐ |
| 2 | Acessar o painel autenticado | ✅ E2E login/logout | ☐ |
| 3 | Cadastrar uma roupa com fotos | ✅ E2E (2 fotos no Storage) | ☐ |
| 4 | Definir cores, tamanhos e estoque | ✅ E2E (4 variações com estoque próprio) | ☐ |
| 5 | Alterar o preço | ✅ E2E | ☐ |
| 6 | Criar uma promoção (agendada/expirada/no ar) | ✅ E2E + testes de banco | ☐ |
| 7 | Publicar o produto | ✅ E2E | ☐ |
| 8 | Abrir a loja pública | ✅ E2E | ☐ |
| 9 | Ver os dados cadastrados na vitrine | ✅ E2E | ☐ |
| 10 | Fazer um pedido de teste (WhatsApp) | ✅ E2E (mensagem, snapshot, reserva) — o **envio** no WhatsApp é manual e não é testável | ☐ |
| 11 | Conferir o pedido no painel | ✅ E2E | ☐ |
| 12 | Atualizar o status do pedido | ✅ E2E (confirmar, cancelar devolve estoque) | ☐ |
| 13 | Recarregar e confirmar persistência | ✅ E2E | ☐ (e após novo deploy) |
| 14 | Outro lojista não acessa esses dados | ✅ E2E (UI + API com token) e testes de banco | ☐ |
| 15 | Build e deploy sem erros críticos | ✅ build local · ❌ deploy não executado | ☐ |
| 16 | Nenhuma chave secreta exposta | ✅ varredura dos bundles/HTML | ☐ (confira no navegador em produção) |

Antes de vender: configurar SMTP próprio, revisar **custos** (`COSTS.md`), definir política de privacidade/LGPD da loja e
combinar com o cliente que o pagamento e o frete são tratados **por fora**, pelo WhatsApp.
