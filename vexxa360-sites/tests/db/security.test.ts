import { beforeAll, describe, expect, it } from "vitest";
import { DB_URL, as, errorOf, resetDb, rows, seed, su, type Seed } from "./helpers";

describe.skipIf(!DB_URL)("segurança e isolamento entre lojas (RLS)", () => {
  let s: Seed;
  let pA: Awaited<ReturnType<Seed["product"]>>;
  let pADraft: Awaited<ReturnType<Seed["product"]>>;
  let pB: Awaited<ReturnType<Seed["product"]>>;
  let pC: Awaited<ReturnType<Seed["product"]>>;

  beforeAll(async () => {
    await resetDb();
    s = await seed();
    pA = await s.product(s.A, "Camiseta A", 100);
    pADraft = await s.product(s.A, "Rascunho A", 50, { status: "draft" });
    pB = await s.product(s.B, "Camiseta B", 120);
    pC = await s.product(s.C, "Produto Oculto", 80);
    await su("insert into product_costs (product_id, tenant_id, cost_price) values ($1,$2,40)", [pA.id, s.A]);
    await su("insert into product_costs (product_id, tenant_id, cost_price) values ($1,$2,60)", [pB.id, s.B]);
  });

  it("lojista A vê rascunhos só da loja A; da loja B só o que é público na vitrine", async () => {
    const pBDraft = await s.product(s.B, "Rascunho B", 70, { status: "draft" });
    const r = await rows("authenticated", s.ua, "select id, tenant_id, status from products");
    const ids = r.map((x) => x.id);
    expect(ids).toContain(pADraft.id);
    expect(ids).not.toContain(pBDraft.id);                               // rascunho de B: invisível
    expect(r.filter((x) => x.tenant_id === s.B).every((x) => x.status === "published")).toBe(true);
    // como o RLS também libera a vitrine, o painel SEMPRE filtra por tenant_id (ver src/lib/auth)
    const own = await rows("authenticated", s.ua, "select id from products where tenant_id=$1", [s.A]);
    expect(own.map((x) => x.id).sort()).toEqual([pA.id, pADraft.id].sort());
  });

  it("lojista A não consegue criar produto na loja B", async () => {
    const e = await errorOf("authenticated", s.ua, "insert into products (tenant_id,name,slug,regular_price) values ($1,'x','x',10)", [s.B]);
    expect(e).toMatch(/row-level security/);
  });

  it("lojista A não altera nem apaga produto da loja B (0 linhas afetadas)", async () => {
    const upd = await as("authenticated", s.ua, (c) => c.query("update products set name='hack' where id=$1", [pB.id]));
    expect(upd.rowCount).toBe(0);
    const del = await as("authenticated", s.ua, (c) => c.query("delete from products where id=$1", [pB.id]));
    expect(del.rowCount).toBe(0);
    expect((await su("select name from products where id=$1", [pB.id])).rows[0].name).toBe("Camiseta B");
  });

  it("não deixa mover produto de A para a loja B alterando tenant_id", async () => {
    const e = await errorOf("authenticated", s.ua, "update products set tenant_id=$2 where id=$1", [pA.id, s.B]);
    expect(e).not.toBeNull();
  });

  it("integridade composta: produto de A não pode usar categoria de B", async () => {
    const catB = (await su("insert into categories (tenant_id,name,slug) values ($1,'Cat B','cat-b') returning id", [s.B])).rows[0].id;
    // superusuário também é barrado pela FK composta (não é só RLS)
    await expect(su("update products set category_id=$1 where id=$2", [catB, pA.id])).rejects.toThrow(/foreign key/);
  });

  it("integridade composta: variação/imagem/promoção não cruzam lojas", async () => {
    await expect(su("insert into product_variants (tenant_id,product_id,size,stock_quantity) values ($1,$2,'G',1)", [s.B, pA.id])).rejects.toThrow(/foreign key/);
    await expect(su("insert into promotions (tenant_id,name,product_id,discount_type,discount_value,starts_at,ends_at) values ($1,'x',$2,'percent',10,now(),now()+interval '1 day')", [s.B, pA.id])).rejects.toThrow(/foreign key/);
    await expect(su("insert into product_images (tenant_id,product_id,storage_path) values ($1,$2,$3)", [s.B, pA.id, `${s.B}/x.jpg`])).rejects.toThrow(/foreign key/);
  });

  it("imagem precisa estar na pasta da própria loja", async () => {
    await expect(su("insert into product_images (tenant_id,product_id,storage_path) values ($1,$2,$3)", [s.A, pA.id, `${s.B}/x.jpg`])).rejects.toThrow(/check constraint/);
  });

  it("visitante (anon) vê apenas produtos publicados de lojas publicadas", async () => {
    const r = await rows("anon", null, "select id from products");
    const ids = r.map((x) => x.id);
    expect(ids).toContain(pA.id);
    expect(ids).toContain(pB.id);
    expect(ids).not.toContain(pADraft.id);   // rascunho
    expect(ids).not.toContain(pC.id);        // loja não publicada
  });

  it("custo de aquisição nunca é visível para anon nem para outra loja", async () => {
    expect(await errorOf("anon", null, "select * from product_costs")).toMatch(/permission denied/);
    expect(await rows("authenticated", s.ua, "select product_id from product_costs")).toEqual([{ product_id: pA.id }]);
    expect(await rows("authenticated", s.ub, "select product_id from product_costs")).toEqual([{ product_id: pB.id }]);
    // equipe (staff) também não vê custos
    expect(await rows("authenticated", s.sa, "select product_id from product_costs")).toEqual([]);
  });

  it("usuário sem vínculo não vê rascunhos nem pedidos", async () => {
    expect((await rows("authenticated", s.uc, "select id from products")).map((x) => x.id)).not.toContain(pADraft.id);
    expect(await rows("authenticated", s.uc, "select id from orders")).toEqual([]);
  });

  it("anon não lê pedidos, memberships, platform_admins nem audit_log", async () => {
    for (const t of ["orders", "order_items", "memberships", "platform_admins", "audit_log", "inventory_movements", "order_counters"]) {
      expect(await errorOf("anon", null, `select * from ${t}`), t).toMatch(/permission denied/);
    }
  });

  it("anon não lê colunas internas de store_settings", async () => {
    expect(await errorOf("anon", null, "select low_stock_threshold from store_settings")).toMatch(/permission denied/);
    expect((await rows("anon", null, "select store_name from store_settings")).length).toBe(2); // A e B; C não publicada
  });

  it("ninguém altera o próprio papel nem cria vínculo (anti-escalada)", async () => {
    expect(await errorOf("authenticated", s.sa, "update memberships set role='owner' where user_id=$1", [s.sa])).toMatch(/permission denied/);
    expect(await errorOf("authenticated", s.uc, "insert into memberships (tenant_id,user_id,role) values ($1,$2,'owner')", [s.A, s.uc])).toMatch(/permission denied/);
    expect(await errorOf("authenticated", s.ua, "insert into platform_admins (user_id) values ($1)", [s.ua])).toMatch(/permission denied/);
    expect(await errorOf("authenticated", s.ua, "insert into tenants (name,slug) values ('x','xx')")).toMatch(/permission denied/);
  });

  it("perfil: só edita o próprio nome (não e-mail, não de outros)", async () => {
    expect(await errorOf("authenticated", s.ua, "update profiles set email='x@x.com' where id=$1", [s.ua])).toMatch(/permission denied/);
    const own = await as("authenticated", s.ua, (c) => c.query("update profiles set name='Novo' where id=$1", [s.ua]));
    expect(own.rowCount).toBe(1);
    const other = await as("authenticated", s.ua, (c) => c.query("update profiles set name='Hack' where id=$1", [s.ub]));
    expect(other.rowCount).toBe(0);
  });

  it("staff não altera configurações da loja; owner altera; outra loja não", async () => {
    expect((await as("authenticated", s.sa, (c) => c.query("update store_settings set store_name='X' where tenant_id=$1", [s.A]))).rowCount).toBe(0);
    expect((await as("authenticated", s.ua, (c) => c.query("update store_settings set store_name='Loja A+' where tenant_id=$1", [s.A]), true)).rowCount).toBe(1);
    expect((await as("authenticated", s.ub, (c) => c.query("update store_settings set store_name='Hack' where tenant_id=$1", [s.A]))).rowCount).toBe(0);
  });

  it("estoque só muda por funções auditadas (update direto é negado)", async () => {
    const v = pA.variants["P|Preta"];
    expect(await errorOf("authenticated", s.ua, "update product_variants set stock_quantity=999 where id=$1", [v])).toMatch(/permission denied/);
  });

  it("adjust_stock: staff da loja pode; outra loja não; nunca negativo; gera histórico", async () => {
    const v = pA.variants["P|Preta"];
    expect(await errorOf("authenticated", s.ub, "select adjust_stock($1, 5, 'entry', 'x')", [v])).toMatch(/VARIANT_NOT_FOUND/);
    expect(await errorOf("authenticated", s.sa, "select adjust_stock($1, -999, 'loss', 'x')", [v])).toMatch(/NEGATIVE_STOCK/);
    const r = await as("authenticated", s.sa, async (c) => (await c.query("select adjust_stock($1, 3, 'entry', 'reposição') as q", [v])).rows[0].q, true);
    expect(r).toBe(8);
    const mv = await rows("authenticated", s.ua, "select movement_type, quantity from inventory_movements where variant_id=$1 order by created_at", [v]);
    expect(mv.map((m) => m.movement_type)).toEqual(["initial", "entry"]);
    // restaura
    await as("authenticated", s.sa, (c) => c.query("select set_stock($1, 5, 'contagem')", [v]), true);
    expect((await su("select stock_quantity from product_variants where id=$1", [v])).rows[0].stock_quantity).toBe(5);
  });

  it("place_order não é chamável por navegador (anon/authenticated)", async () => {
    const args = ["loja-a", "Maria", "11999998888", null, null, JSON.stringify([{ variant_id: pA.variants["P|Preta"], quantity: 1 }])];
    expect(await errorOf("anon", null, "select place_order($1,$2,$3,$4,$5,$6::jsonb)", args)).toMatch(/permission denied/);
    expect(await errorOf("authenticated", s.ua, "select place_order($1,$2,$3,$4,$5,$6::jsonb)", args)).toMatch(/permission denied/);
  });

  it("is_platform_admin só é verdadeiro para o admin da plataforma", async () => {
    expect((await rows("authenticated", s.master, "select is_platform_admin() v"))[0].v).toBe(true);
    expect((await rows("authenticated", s.ua, "select is_platform_admin() v"))[0].v).toBe(false);
  });

  it("Storage: escrita só na pasta da própria loja", async () => {
    const ins = (uid: string | null, role: "authenticated" | "anon", name: string) =>
      errorOf(role, uid, "insert into storage.objects (bucket_id, name) values ('store-media', $1)", [name]);
    expect(await ins(s.ua, "authenticated", `${s.A}/products/x.jpg`)).toBeNull();
    expect(await ins(s.sa, "authenticated", `${s.A}/products/x.jpg`)).toBeNull();
    expect(await ins(s.ua, "authenticated", `${s.B}/products/x.jpg`)).toMatch(/row-level security/);
    expect(await ins(s.uc, "authenticated", `${s.A}/products/x.jpg`)).toMatch(/row-level security/);
    expect(await ins(null, "anon", `${s.A}/products/x.jpg`)).toMatch(/permission denied|row-level security/);
    expect(await ins(s.ua, "authenticated", `nao-uuid/x.jpg`)).toMatch(/row-level security/);
    expect(await ins(s.ua, "authenticated", `../${s.B}/x.jpg`)).toMatch(/row-level security/);
  });

  it("auditoria: alterações em produtos ficam registradas, só donos/admins leem", async () => {
    const a = await rows("authenticated", s.ua, "select entity from audit_log where entity='products'");
    expect(a.length).toBeGreaterThan(0);
    expect(await rows("authenticated", s.sa, "select * from audit_log")).toEqual([]);
    expect(await rows("authenticated", s.ub, "select * from audit_log where tenant_id=$1", [s.A])).toEqual([]);
  });
});
