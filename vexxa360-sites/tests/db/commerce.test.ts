import { beforeAll, describe, expect, it } from "vitest";
import { DB_URL, as, errorOf, resetDb, rows, seed, su, type Seed } from "./helpers";

type P = Awaited<ReturnType<Seed["product"]>>;

const order = (slug: string, items: { variant_id: string; quantity: number }[], name = "Maria Silva", phone = "(11) 99999-8888") =>
  as("service_role", null, async (c) =>
    (await c.query("select place_order($1,$2,$3,$4,$5,$6::jsonb) as r", [slug, name, phone, null, "obs", JSON.stringify(items)])).rows[0].r,
  true);

describe.skipIf(!DB_URL)("preços, promoções, pedidos e estoque", () => {
  let s: Seed;
  let tee: P;

  beforeAll(async () => {
    await resetDb();
    s = await seed();
    tee = await s.product(s.A, "Camiseta Preta", 149.9, { stock: { "P|Preta": 10, "M|Preta": 8, "G|Preta": 0, "P|Branca": 7 } });
  });

  const price = async (id: string, at = "now()") => Number((await su(`select effective_price($1, ${at}) p`, [id])).rows[0].p);

  it("preço normal sem promoção", async () => {
    expect(await price(tee.id)).toBe(149.9);
  });

  it("rejeita preço negativo, promocional ≥ normal e promoções inválidas", async () => {
    await expect(su("update products set regular_price=-1 where id=$1", [tee.id])).rejects.toThrow(/check/);
    await expect(su("update products set promotional_price=149.90 where id=$1", [tee.id])).rejects.toThrow(/check/);
    const ins = (type: string, v: number, from: string, to: string) =>
      su(`insert into promotions (tenant_id,name,discount_type,discount_value,starts_at,ends_at) values ($1,'p',$2,$3,${from},${to})`, [s.A, type, v]);
    await expect(ins("percent", -5, "now()", "now()+interval '1 day'")).rejects.toThrow(/check/);
    await expect(ins("percent", 95, "now()", "now()+interval '1 day'")).rejects.toThrow(/check/);
    await expect(ins("percent", 10, "now()", "now()-interval '1 day'")).rejects.toThrow(/check/);
  });

  it("promoção agendada: só vale dentro da vigência (futura, ativa, expirada)", async () => {
    await su("insert into promotions (tenant_id,name,product_id,discount_type,discount_value,starts_at,ends_at) values ($1,'Futura',$2,'fixed_price',99.90,now()+interval '1 day',now()+interval '2 day')", [s.A, tee.id]);
    expect(await price(tee.id)).toBe(149.9);                               // ainda não começou
    expect(await price(tee.id, "now()+interval '36 hours'")).toBe(99.9);   // dentro da janela
    expect(await price(tee.id, "now()+interval '3 days'")).toBe(149.9);    // expirou sozinha
    await su("delete from promotions where tenant_id=$1", [s.A]);
    await su("insert into promotions (tenant_id,name,product_id,discount_type,discount_value,starts_at,ends_at) values ($1,'Agora',$2,'fixed_price',99.90,now()-interval '1 hour',now()+interval '1 day')", [s.A, tee.id]);
    expect(await price(tee.id)).toBe(99.9);
    const [cat] = await rows("anon", null, "select effective_price, on_sale, discount_percent, regular_price from catalog_products where id=$1", [tee.id]);
    expect(Number(cat.effective_price)).toBe(99.9);
    expect(cat.on_sale).toBe(true);
    expect(cat.discount_percent).toBe(33);    // 149,90 → 99,90
    await su("update promotions set active=false where tenant_id=$1", [s.A]);
    expect(await price(tee.id)).toBe(149.9);  // desativada
  });

  it("percentual e valor fixo de desconto; escolhe a melhor oferta", async () => {
    await su("delete from promotions where tenant_id=$1", [s.A]);
    await su("insert into promotions (tenant_id,name,discount_type,discount_value,starts_at,ends_at) values ($1,'Loja toda 10%','percent',10,now()-interval '1 hour',now()+interval '1 day')", [s.A]);
    expect(await price(tee.id)).toBe(134.91);
    await su("insert into promotions (tenant_id,name,product_id,discount_type,discount_value,starts_at,ends_at) values ($1,'R$ 20 off',$2,'amount_off',20,now()-interval '1 hour',now()+interval '1 day')", [s.A, tee.id]);
    expect(await price(tee.id)).toBe(129.9);
    await su("update products set promotional_price=119.90 where id=$1", [tee.id]);
    expect(await price(tee.id)).toBe(119.9);
    await su("update products set promotional_price=null where id=$1", [tee.id]);
    await su("delete from promotions where tenant_id=$1", [s.A]);
  });

  it("pedido: usa preço do servidor, tira snapshot, baixa estoque e registra movimento", async () => {
    await su("insert into promotions (tenant_id,name,product_id,discount_type,discount_value,starts_at,ends_at) values ($1,'Oferta',$2,'fixed_price',99.90,now()-interval '1 hour',now()+interval '1 day')", [s.A, tee.id]);
    const r = await order("loja-a", [{ variant_id: tee.variants["P|Preta"], quantity: 2 }, { variant_id: tee.variants["M|Preta"], quantity: 1 }]);
    expect(r.order_number).toBe(1);
    expect(r.total).toBe(299.7);
    expect(r.subtotal).toBe(449.7);
    expect(r.discount_amount).toBe(150);
    expect(r.whatsapp).toBe("5511999990001");

    const items = (await su("select * from order_items where order_id=$1 order by size_snapshot", [r.order_id])).rows;
    expect(items).toHaveLength(2);
    expect(Number(items[0].unit_price)).toBe(99.9);
    expect(items[0].product_name_snapshot).toBe("Camiseta Preta");
    expect(items[0].size_snapshot).toBe("M");

    expect((await su("select stock_quantity q from product_variants where id=$1", [tee.variants["P|Preta"]])).rows[0].q).toBe(8);
    const mv = (await su("select quantity from inventory_movements where order_id=$1 and movement_type='reservation'", [r.order_id])).rows;
    expect(mv.map((m) => m.quantity).sort((a, b) => a - b)).toEqual([-2, -1]);
    const o = (await su("select status, customer_phone from orders where id=$1", [r.order_id])).rows[0];
    expect(o.status).toBe("new");                   // nunca nasce pago/confirmado
    expect(o.customer_phone).toBe("11999998888");   // só dígitos
  });

  it("histórico imutável: mudar preço/nome/arquivar produto não altera pedidos antigos", async () => {
    const before = (await su("select unit_price, product_name_snapshot, line_total from order_items order by size_snapshot")).rows;
    await su("update products set regular_price=300, name='Camiseta Renomeada' where id=$1", [tee.id]);
    await su("update products set archived_at=now() where id=$1", [tee.id]);
    const after = (await su("select unit_price, product_name_snapshot, line_total from order_items order by size_snapshot")).rows;
    expect(after).toEqual(before);
    await su("update products set regular_price=149.90, name='Camiseta Preta', archived_at=null where id=$1", [tee.id]);
  });

  it("excluir produto não destrói o histórico de vendas", async () => {
    const tmp = await s.product(s.A, "Temporário", 10, { stock: { "U|Azul": 3 } });
    const r = await order("loja-a", [{ variant_id: tmp.variants["U|Azul"], quantity: 1 }]);
    await su("delete from products where id=$1", [tmp.id]);
    const it = (await su("select product_id, variant_id, product_name_snapshot, unit_price from order_items where order_id=$1", [r.order_id])).rows[0];
    expect(it.product_id).toBeNull();
    expect(it.product_name_snapshot).toBe("Temporário");
    expect(Number(it.unit_price)).toBe(10);
  });

  it("numeração sequencial independente por loja", async () => {
    const pb = await s.product(s.B, "Peça B", 50, { stock: { "U|Azul": 5 } });
    const rb = await order("loja-b", [{ variant_id: pb.variants["U|Azul"], quantity: 1 }]);
    expect(rb.order_number).toBe(1);
    const ra = await order("loja-a", [{ variant_id: tee.variants["P|Branca"], quantity: 1 }]);
    expect(ra.order_number).toBeGreaterThan(1);
  });

  it("recusa itens inválidos: outra loja, sem estoque, rascunho, inativo, loja oculta, qtd inválida", async () => {
    const pb = await s.product(s.B, "Peça B2", 50, { stock: { "U|Azul": 5 } });
    const draft = await s.product(s.A, "Rascunho", 50, { status: "draft" });
    const hidden = await s.product(s.C, "Oculto", 50);
    const inactive = await s.product(s.A, "Inativo", 50, { stock: { "U|Azul": 5 } });
    await su("update product_variants set active=false where id=$1", [inactive.variants["U|Azul"]]);
    const fail = (slug: string, v: string, q: number) => order(slug, [{ variant_id: v, quantity: q }]).then(() => "ok", (e) => (e as Error).message);

    expect(await fail("loja-a", pb.variants["U|Azul"], 1)).toMatch(/ITEM_UNAVAILABLE/);        // variação de OUTRA loja
    expect(await fail("loja-a", tee.variants["G|Preta"], 1)).toMatch(/INSUFFICIENT_STOCK/);     // estoque 0
    expect(await fail("loja-a", tee.variants["P|Branca"], 999)).toMatch(/INVALID_QUANTITY/);
    expect(await fail("loja-a", tee.variants["P|Branca"], 0)).toMatch(/INVALID_QUANTITY/);
    expect(await fail("loja-a", draft.variants["P|Preta"], 1)).toMatch(/ITEM_UNAVAILABLE/);
    expect(await fail("loja-a", inactive.variants["U|Azul"], 1)).toMatch(/ITEM_UNAVAILABLE/);
    expect(await fail("loja-oculta", hidden.variants["P|Preta"], 1)).toMatch(/STORE_NOT_FOUND/);
    expect(await fail("nao-existe", tee.variants["P|Preta"], 1)).toMatch(/STORE_NOT_FOUND/);
    await expect(order("loja-a", [])).rejects.toThrow(/EMPTY_CART/);
    await expect(order("loja-a", [{ variant_id: tee.variants["P|Branca"], quantity: 1 }], "A", "11999998888")).rejects.toThrow(/INVALID_NAME/);
    await expect(order("loja-a", [{ variant_id: tee.variants["P|Branca"], quantity: 1 }], "Maria", "123")).rejects.toThrow(/INVALID_PHONE/);
  });

  it("pedido com falha é atômico: nada é baixado se um item falha", async () => {
    const before = (await su("select stock_quantity q from product_variants where id=$1", [tee.variants["P|Branca"]])).rows[0].q;
    await expect(order("loja-a", [
      { variant_id: tee.variants["P|Branca"], quantity: 1 },
      { variant_id: tee.variants["G|Preta"], quantity: 1 },     // sem estoque
    ])).rejects.toThrow(/INSUFFICIENT_STOCK/);
    expect((await su("select stock_quantity q from product_variants where id=$1", [tee.variants["P|Branca"]])).rows[0].q).toBe(before);
  });

  it("concorrência: 15 compras simultâneas da última unidade → apenas 1 vence", async () => {
    const last = await s.product(s.A, "Última Peça", 80, { stock: { "U|Verde": 1 } });
    const results = await Promise.allSettled(
      Array.from({ length: 15 }, () => order("loja-a", [{ variant_id: last.variants["U|Verde"], quantity: 1 }])),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(14);
    expect((await su("select stock_quantity q from product_variants where id=$1", [last.variants["U|Verde"]])).rows[0].q).toBe(0);
    const n = (await su("select count(*)::int n from order_items where variant_id=$1", [last.variants["U|Verde"]])).rows[0].n;
    expect(n).toBe(1);
  });

  it("concorrência: números de pedido não repetem sob carga", async () => {
    const big = await s.product(s.A, "Estoque Alto", 10, { stock: { "U|Cinza": 100 } });
    await Promise.all(Array.from({ length: 20 }, () => order("loja-a", [{ variant_id: big.variants["U|Cinza"], quantity: 1 }])));
    const dup = (await su("select count(*)::int n from (select order_number from orders where tenant_id=$1 group by 1 having count(*)>1) d", [s.A])).rows[0].n;
    expect(dup).toBe(0);
    expect((await su("select stock_quantity q from product_variants where id=$1", [big.variants["U|Cinza"]])).rows[0].q).toBe(80);
  });

  it("status: lojista atualiza, histórico registra; outra loja não enxerga o pedido", async () => {
    const prod = await s.product(s.A, "Para Status", 60, { stock: { "U|Rosa": 4 } });
    const r = await order("loja-a", [{ variant_id: prod.variants["U|Rosa"], quantity: 2 }]);
    expect(await errorOf("authenticated", s.ub, "select change_order_status($1,'confirmed')", [r.order_id])).toMatch(/ORDER_NOT_FOUND/);
    expect(await errorOf("authenticated", s.uc, "select change_order_status($1,'confirmed')", [r.order_id])).toMatch(/ORDER_NOT_FOUND/);
    expect(await errorOf("anon", null, "select change_order_status($1,'confirmed')", [r.order_id])).toMatch(/permission denied/);
    expect(await rows("authenticated", s.ub, "select id from orders where id=$1", [r.order_id])).toEqual([]);

    await as("authenticated", s.ua, (c) => c.query("select change_order_status($1,'confirmed')", [r.order_id]), true);
    await as("authenticated", s.sa, (c) => c.query("select change_order_status($1,'preparing')", [r.order_id]), true);
    const h = await rows("authenticated", s.ua, "select previous_status, new_status from order_status_history where order_id=$1 order by created_at, new_status", [r.order_id]);
    expect(h.map((x) => x.new_status)).toEqual(expect.arrayContaining(["new", "confirmed", "preparing"]));
    expect(h).toHaveLength(3);
    // atualização direta de status/total é negada
    expect(await errorOf("authenticated", s.ua, "update orders set status='completed' where id=$1", [r.order_id])).toMatch(/permission denied/);
    expect(await errorOf("authenticated", s.ua, "update orders set total=1 where id=$1", [r.order_id])).toMatch(/permission denied/);
    expect(await errorOf("authenticated", s.ua, "update order_items set unit_price=1 where order_id=$1", [r.order_id])).toMatch(/permission denied/);
  });

  it("cancelar devolve o estoque uma única vez e é terminal", async () => {
    const prod = await s.product(s.A, "Para Cancelar", 60, { stock: { "U|Rosa": 4 } });
    const v = prod.variants["U|Rosa"];
    const r = await order("loja-a", [{ variant_id: v, quantity: 3 }]);
    expect((await su("select stock_quantity q from product_variants where id=$1", [v])).rows[0].q).toBe(1);
    await as("authenticated", s.ua, (c) => c.query("select change_order_status($1,'cancelled')", [r.order_id]), true);
    expect((await su("select stock_quantity q from product_variants where id=$1", [v])).rows[0].q).toBe(4);
    expect(await errorOf("authenticated", s.ua, "select change_order_status($1,'confirmed')", [r.order_id])).toMatch(/ORDER_TERMINAL/);
    expect(await errorOf("authenticated", s.ua, "select change_order_status($1,'cancelled')", [r.order_id])).toMatch(/ORDER_TERMINAL/);
    expect((await su("select stock_quantity q from product_variants where id=$1", [v])).rows[0].q).toBe(4);
  });

  it("reservas expiradas são liberadas (apenas pedidos 'new' antigos)", async () => {
    const prod = await s.product(s.A, "Reserva", 60, { stock: { "U|Lilás": 5 } });
    const v = prod.variants["U|Lilás"];
    const old = await order("loja-a", [{ variant_id: v, quantity: 2 }]);
    const confirmed = await order("loja-a", [{ variant_id: v, quantity: 1 }]);
    const fresh = await order("loja-a", [{ variant_id: v, quantity: 1 }]);
    await as("authenticated", s.ua, (c) => c.query("select change_order_status($1,'confirmed')", [confirmed.order_id]), true);
    await su("update orders set created_at = now() - interval '5 days' where id = any($1)", [[old.order_id, confirmed.order_id]]);

    expect(await errorOf("authenticated", s.ub, "select release_expired_reservations($1)", [s.A])).toMatch(/FORBIDDEN/);
    const n = await as("authenticated", s.ua, async (c) => (await c.query("select release_expired_reservations($1) n", [s.A])).rows[0].n, true);
    expect(n).toBe(1);
    const st = Object.fromEntries((await su("select id, status from orders where id = any($1)", [[old.order_id, confirmed.order_id, fresh.order_id]])).rows.map((x) => [x.id, x.status]));
    expect(st[old.order_id]).toBe("cancelled");
    expect(st[confirmed.order_id]).toBe("confirmed");
    expect(st[fresh.order_id]).toBe("new");
    expect((await su("select stock_quantity q from product_variants where id=$1", [v])).rows[0].q).toBe(3);   // 5-2-1-1+2
  });

  it("dashboard: faturamento conta só confirmados+; isolado por loja", async () => {
    const stats = (uid: string, tenant: string) =>
      as("authenticated", uid, async (c) => (await c.query("select dashboard_stats($1, now()-interval '30 days', now()+interval '1 day') s", [tenant])).rows[0].s);
    const a = await stats(s.ua, s.A);
    const expected = Number((await su("select coalesce(sum(total),0) t from orders where tenant_id=$1 and status in ('confirmed','preparing','shipped','completed')", [s.A])).rows[0].t);
    expect(a.revenue).toBe(expected);
    expect(a.revenue).toBeGreaterThan(0);
    expect(a.orders_new).toBeGreaterThan(0);
    expect(a.total_products).toBeGreaterThan(0);
    // usuário da loja B (ou sem vínculo) pedindo estatísticas da loja A é recusado
    await expect(stats(s.ub, s.A)).rejects.toThrow(/FORBIDDEN/);
    await expect(stats(s.uc, s.A)).rejects.toThrow(/FORBIDDEN/);
  });

  it("variações: combinação tamanho+cor é única por produto; estoque nunca negativo", async () => {
    await expect(su("insert into product_variants (tenant_id,product_id,size,color,stock_quantity) values ($1,$2,'P','Preta',1)", [s.A, tee.id])).rejects.toThrow(/duplicate key/);
    await expect(su("update product_variants set stock_quantity=-1 where id=$1", [tee.variants["P|Preta"]])).rejects.toThrow(/check/);
  });

  it("slug de loja inválido é rejeitado; domínio exige ativação para resolver", async () => {
    await expect(su("insert into tenants (name,slug) values ('x','Slug Inválido!')")).rejects.toThrow(/check/);
    await su("insert into tenant_domains (tenant_id, hostname, status) values ($1,'www.lojaa.com.br','pending')", [s.A]);
    expect((await su("select resolve_tenant_slug('www.lojaa.com.br') s")).rows[0].s).toBeNull();
    await su("update tenant_domains set status='active' where hostname='www.lojaa.com.br'");
    expect((await su("select resolve_tenant_slug('WWW.lojaa.com.br') s")).rows[0].s).toBe("loja-a");
  });
});
