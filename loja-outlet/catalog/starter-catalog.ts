// Catálogo inicial (DEMONSTRAÇÃO) do Outlet 3K: 35 produtos genéricos, sem marcas, para a vitrine nascer preenchida.
// Os SKUs começam com "OUT3K-". Preços e estoques são ilustrativos: confira tudo no painel antes de vender.
// As fotos vêm do Unsplash (ver catalog/sources.json e CREDITS.md) e NÃO mostram os produtos reais da loja.

export type StarterProduct = {
  sku: string;
  category: "camisas" | "calcas" | "tenis" | "blusas-e-jaquetas" | "relogios";
  name: string;
  description: string;
  priceCents: number;
  color: string;
  sizes: string[];
  stock: number;
  featured?: boolean;
  isNew?: boolean;
};

export const STARTER_PREFIX = "OUT3K-";

export const STARTER_CATEGORIES = [
  { slug: "camisas", name: "Camisas", position: 1 },
  { slug: "calcas", name: "Calças", position: 2 },
  { slug: "tenis", name: "Tênis", position: 3 },
  { slug: "blusas-e-jaquetas", name: "Blusas e jaquetas", position: 4 },
  { slug: "relogios", name: "Relógios", position: 5 },
] as const;

const TOP = ["P", "M", "G", "GG"];
const PANTS = ["38", "40", "42", "44", "46"];
const SHOES = ["38", "39", "40", "41", "42", "43", "44"];
const ONE = ["Único"];

export const STARTER_CATALOG: StarterProduct[] = [
  // ---------- Camisas ----------
  { sku: "OUT3K-CAM-001", category: "camisas", name: "Camisa Casual Manga Longa Cru", priceCents: 13990, color: "Cru", sizes: TOP, stock: 10,
    description: "Camisa casual de manga longa com gola padre e abotoamento frontal. Visual leve e versátil para o dia a dia, em tom cru." },
  { sku: "OUT3K-CAM-002", category: "camisas", name: "Camiseta Oversized Branca", priceCents: 9990, color: "Branco", sizes: TOP, stock: 10, isNew: true,
    description: "Camiseta oversized de modelagem ampla, gola redonda e manga curta, com pequeno bordado no peito. Combina com calças de corte reto ou largo." },
  { sku: "OUT3K-CAM-003", category: "camisas", name: "Camiseta Premium Algodão Branca", priceCents: 8990, color: "Branco", sizes: TOP, stock: 10, featured: true,
    description: "Camiseta básica de gola redonda e caimento ajustado, lisa, para usar sozinha ou por baixo de jaquetas e camisas." },
  { sku: "OUT3K-CAM-004", category: "camisas", name: "Camisa Polo Preta Detalhe Contraste", priceCents: 11990, color: "Preto", sizes: TOP, stock: 10,
    description: "Polo preta de manga curta com gola e punhos com detalhe em contraste. Fecho com botões e modelagem ajustada." },
  { sku: "OUT3K-CAM-005", category: "camisas", name: "Camisa Social Slim Azul Claro", priceCents: 16990, color: "Azul claro", sizes: TOP, stock: 10,
    description: "Camisa social masculina de manga longa, gola clássica e modelagem slim, em azul claro. Para o trabalho e ocasiões formais." },
  { sku: "OUT3K-CAM-006", category: "camisas", name: "Camisa Estampada Manga Curta", priceCents: 12990, color: "Estampada", sizes: TOP, stock: 10,
    description: "Camisa de manga curta com estampa em tons claros e gola aberta. Boa pedida para dias quentes e passeios." },
  { sku: "OUT3K-CAM-007", category: "camisas", name: "Camiseta Streetwear Estampa Abstrata", priceCents: 10990, color: "Preto", sizes: TOP, stock: 10, featured: true,
    description: "Camiseta preta de modelagem solta com estampa abstrata colorida na frente. Estilo urbano para compor looks despojados." },
  { sku: "OUT3K-CAM-008", category: "camisas", name: "Camiseta Esportiva Casual Azul-Petróleo", priceCents: 7990, color: "Azul-petróleo", sizes: TOP, stock: 10, isNew: true,
    description: "Camiseta de corte esportivo, gola redonda e visual limpo, em azul-petróleo. Para treinos leves e uso casual." },

  // ---------- Calças ----------
  { sku: "OUT3K-CAL-001", category: "calcas", name: "Calça Jeans Slim Azul Médio", priceCents: 18990, color: "Azul médio", sizes: PANTS, stock: 8,
    description: "Calça jeans de corte slim, cintura média e barra com dobra, em lavagem azul média. Cinco bolsos." },
  { sku: "OUT3K-CAL-002", category: "calcas", name: "Calça Jeans Reta Lavagem Clara", priceCents: 19990, color: "Azul claro", sizes: PANTS, stock: 8,
    description: "Calça jeans de corte reto e cintura alta, em lavagem clara. Fecho com botões e cinco bolsos." },
  { sku: "OUT3K-CAL-003", category: "calcas", name: "Calça Cargo Verde Oliva", priceCents: 21990, color: "Verde oliva", sizes: PANTS, stock: 8, featured: true,
    description: "Calça cargo de modelagem reta com bolsos laterais de fole, em verde oliva. Visual utilitário e confortável." },
  { sku: "OUT3K-CAL-004", category: "calcas", name: "Calça Jogger Preta com Punhos", priceCents: 15990, color: "Preto", sizes: TOP, stock: 8,
    description: "Calça jogger preta com cintura elástica e punhos ajustados nos tornozelos. Confortável para o dia a dia." },
  { sku: "OUT3K-CAL-005", category: "calcas", name: "Calça de Alfaiataria Azul-Petróleo", priceCents: 22990, color: "Azul-petróleo", sizes: PANTS, stock: 8,
    description: "Calça de alfaiataria de corte reto e caimento estruturado, em azul-petróleo. Para looks sociais e de escritório." },
  { sku: "OUT3K-CAL-006", category: "calcas", name: "Calça Wide Leg Bege", priceCents: 17990, color: "Bege", sizes: TOP, stock: 8, isNew: true,
    description: "Calça wide leg de pernas largas e cintura elástica, em bege. Leve e confortável, com caimento fluido." },
  { sku: "OUT3K-CAL-007", category: "calcas", name: "Calça Chino Cáqui", priceCents: 18990, color: "Cáqui", sizes: PANTS, stock: 8,
    description: "Calça chino de modelagem ajustada, em cáqui. Funciona do casual ao esporte fino." },
  { sku: "OUT3K-CAL-008", category: "calcas", name: "Calça Jeans Oversized Azul", priceCents: 20990, color: "Azul", sizes: PANTS, stock: 8, isNew: true,
    description: "Calça jeans oversized de pernas amplas e caimento solto, em azul. Estilo urbano de inspiração anos 90." },

  // ---------- Tênis ----------
  { sku: "OUT3K-TEN-001", category: "tenis", name: "Tênis Casual Branco", priceCents: 24990, color: "Branco", sizes: SHOES, stock: 6,
    description: "Tênis casual branco de cabedal liso, cadarço e solado baixo. Combina com praticamente qualquer look." },
  { sku: "OUT3K-TEN-002", category: "tenis", name: "Tênis Streetwear Robusto Branco", priceCents: 34990, color: "Branco", sizes: SHOES, stock: 6, featured: true,
    description: "Tênis chunky de solado alto e volumoso, na cor branca. Visual marcante para quem gosta de streetwear." },
  { sku: "OUT3K-TEN-003", category: "tenis", name: "Tênis Esportivo para Caminhada Cinza e Preto", priceCents: 27990, color: "Cinza e preto", sizes: SHOES, stock: 6,
    description: "Tênis esportivo nas cores branco, cinza e preto, com cabedal recortado e solado volumoso. Pensado para caminhadas e uso diário." },
  { sku: "OUT3K-TEN-004", category: "tenis", name: "Tênis Minimalista Branco e Bege", priceCents: 25990, color: "Branco e bege", sizes: SHOES, stock: 6, isNew: true,
    description: "Tênis de design minimalista, com cabedal branco e detalhe em bege, sem estampas. Visual limpo e atemporal." },
  { sku: "OUT3K-TEN-005", category: "tenis", name: "Tênis Retrô Solado Cru", priceCents: 26990, color: "Creme", sizes: SHOES, stock: 6,
    description: "Tênis de inspiração retrô em tom creme, com solado em cor natural. Visual vintage e confortável." },
  { sku: "OUT3K-TEN-006", category: "tenis", name: "Tênis Cano Alto Branco Raio Vermelho", priceCents: 32990, color: "Branco e vermelho", sizes: SHOES, stock: 6, featured: true,
    description: "Tênis de cano alto branco com detalhe em raio vermelho na lateral. Estilo esportivo urbano." },
  { sku: "OUT3K-TEN-007", category: "tenis", name: "Tênis Casual Preto", priceCents: 23990, color: "Preto", sizes: SHOES, stock: 6,
    description: "Tênis casual preto de cabedal liso e visual discreto. Versátil para o trabalho e o lazer." },
  { sku: "OUT3K-TEN-008", category: "tenis", name: "Tênis Urbano Premium Creme", priceCents: 39990, color: "Creme", sizes: SHOES, stock: 6, isNew: true,
    description: "Tênis urbano de acabamento refinado, em tom creme com perfurações laterais. Para quem busca um visual sofisticado." },

  // ---------- Blusas e jaquetas ----------
  { sku: "OUT3K-JAQ-001", category: "blusas-e-jaquetas", name: "Moletom Básico com Capuz Taupe", priceCents: 16990, color: "Taupe", sizes: TOP, stock: 10,
    description: "Moletom com capuz e cordão, bolso canguru e punhos em ribana, na cor taupe. Liso, sem estampas." },
  { sku: "OUT3K-JAQ-002", category: "blusas-e-jaquetas", name: "Moletom Oversized Grafite", priceCents: 18990, color: "Grafite", sizes: TOP, stock: 10, isNew: true,
    description: "Moletom de modelagem ampla com capuz e bolso canguru, na cor grafite. Caimento solto e confortável." },
  { sku: "OUT3K-JAQ-003", category: "blusas-e-jaquetas", name: "Blusa de Manga Longa Preta", priceCents: 8990, color: "Preto", sizes: TOP, stock: 10,
    description: "Blusa preta de manga longa e gola redonda, lisa. Boa para usar sozinha ou como segunda pele sob outras peças." },
  { sku: "OUT3K-JAQ-004", category: "blusas-e-jaquetas", name: "Jaqueta Jeans Azul", priceCents: 29990, color: "Azul", sizes: TOP, stock: 10,
    description: "Jaqueta jeans azul com botões frontais, bolsos e gola com revestimento claro. Peça clássica para meia-estação." },
  { sku: "OUT3K-JAQ-005", category: "blusas-e-jaquetas", name: "Jaqueta Bomber Azul-Marinho", priceCents: 32990, color: "Azul-marinho", sizes: TOP, stock: 10, featured: true,
    description: "Jaqueta bomber azul-marinho com zíper frontal e gola alta. Visual esportivo e atual." },
  { sku: "OUT3K-JAQ-006", category: "blusas-e-jaquetas", name: "Jaqueta Corta-Vento Vermelha", priceCents: 24990, color: "Vermelho", sizes: TOP, stock: 10, isNew: true,
    description: "Jaqueta corta-vento vermelha com capuz, de tecido leve. Prática para dias de vento e para guardar na mochila." },
  { sku: "OUT3K-JAQ-007", category: "blusas-e-jaquetas", name: "Jaqueta Puffer Preta", priceCents: 39990, color: "Preto", sizes: TOP, stock: 10, featured: true,
    description: "Jaqueta puffer preta acolchoada, com capuz e zíper frontal. Indicada para dias frios." },
  { sku: "OUT3K-JAQ-008", category: "blusas-e-jaquetas", name: "Jaqueta Casual Premium Caramelo", priceCents: 34990, color: "Caramelo", sizes: TOP, stock: 10, isNew: true,
    description: "Jaqueta casual na cor caramelo, com zíper frontal e gola simples. Acabamento refinado para compor looks do trabalho ao fim de semana." },

  // ---------- Relógios ----------
  { sku: "OUT3K-REL-001", category: "relogios", name: "Relógio Casual Minimalista Rosé", priceCents: 34990, color: "Rosé e taupe", sizes: ONE, stock: 5, featured: true,
    description: "Relógio analógico de visual minimalista: caixa redonda em tom rosé, mostrador branco sem numerais e pulseira taupe." },
  { sku: "OUT3K-REL-002", category: "relogios", name: "Relógio Esportivo Híbrido Preto", priceCents: 44990, color: "Preto", sizes: ONE, stock: 5, isNew: true,
    description: "Relógio de estilo esportivo com mostrador analógico, subdial e pulseira de silicone perfurada, em preto." },
  { sku: "OUT3K-REL-003", category: "relogios", name: "Relógio Clássico com Pulseira Metálica Prata", priceCents: 49990, color: "Prata", sizes: ONE, stock: 5,
    description: "Relógio clássico com caixa e pulseira de elos metálicos em prata, mostrador claro com subdials e aro com detalhes brilhantes." },
];
