-- Vexxa360° Sites — 0002: funções de autorização, RLS e privilégios por coluna
--
-- Modelo de acesso:
--   anon / authenticated  → leitura da VITRINE (somente colunas públicas, só lojas publicadas)
--   membro da loja        → leitura/escrita dos dados da PRÓPRIA loja (papel define o quê)
--   platform_admin        → leitura global (escrita master é feita no servidor com service role)
--   service_role          → usado só no servidor (criar pedido, painel master)
--
-- Tudo é negado por padrão: primeiro revogamos, depois concedemos o mínimo.

-- ------------------------------------------------------------------ helpers
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_tenant_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_tenant_role(p_tenant uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

-- Loja visível ao público: ativa (não suspensa) e publicada pelo lojista.
create or replace function public.tenant_is_public(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tenants t
    join public.store_settings s on s.tenant_id = t.id
    where t.id = p_tenant and t.status = 'active' and s.published
  );
$$;

-- Preço efetivo (em vigor agora): menor entre preço regular, preço promocional
-- do produto e as promoções agendadas ativas e dentro da vigência.
create or replace function public.effective_price(p_product uuid, p_at timestamptz default now())
returns numeric language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce(min(candidate), 0))::numeric(12,2) from (
    select p.regular_price as candidate from public.products p where p.id = p_product
    union all
    select p.promotional_price from public.products p
      where p.id = p_product and p.promotional_price is not null
    union all
    select case pr.discount_type
             when 'percent'     then round(p.regular_price * (1 - pr.discount_value / 100), 2)
             when 'amount_off'  then p.regular_price - pr.discount_value
             when 'fixed_price' then pr.discount_value
           end
    from public.products p
    join public.promotions pr
      on pr.tenant_id = p.tenant_id
     and (pr.product_id is null or pr.product_id = p.id)
     and pr.active and p_at >= pr.starts_at and p_at < pr.ends_at
    where p.id = p_product
  ) c where candidate is not null;
$$;

grant execute on function public.is_platform_admin(), public.is_tenant_member(uuid),
  public.has_tenant_role(uuid, text[]), public.tenant_is_public(uuid),
  public.effective_price(uuid, timestamptz) to anon, authenticated, service_role;

-- --------------------------------------------- 1) negar tudo por padrão
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'tenants','profiles','memberships','platform_admins','tenant_domains','store_settings',
    'categories','products','product_costs','product_images','product_variants',
    'inventory_movements','promotions','order_counters','orders','order_items',
    'order_status_history','banners','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- tenants
grant select (id, name, slug, status) on public.tenants to anon, authenticated;
create policy tenants_public_read on public.tenants for select to anon, authenticated
  using (status = 'active' or public.is_tenant_member(id) or public.is_platform_admin());
-- sem policy de escrita: lojas só são criadas/alteradas pelo painel master (service role)

-- --------------------------------------------------------------- profiles
grant select (id, name, email) on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;      -- e-mail e id nunca editáveis
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------ memberships
grant select on public.memberships to authenticated;
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_tenant_role(tenant_id, array['owner','admin'])
         or public.is_platform_admin());
-- sem escrita para usuários: ninguém altera o próprio papel.

-- -------------------------------------------------------- platform_admins
-- nenhum grant: tabela inacessível via API (a função is_platform_admin() é o único caminho)

-- --------------------------------------------------------- tenant_domains
grant select on public.tenant_domains to authenticated;
create policy domains_member_read on public.tenant_domains for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

-- --------------------------------------------------------- store_settings
grant select (id, tenant_id, store_name, description, logo_path, primary_color, secondary_color,
              whatsapp, contact_email, instagram, address, business_hours, shipping_info,
              privacy_url, terms_url, exchange_url, size_guide, seo_title, seo_description, published)
  on public.store_settings to anon;
grant select on public.store_settings to authenticated;
grant update (store_name, description, logo_path, primary_color, secondary_color, whatsapp,
              contact_email, instagram, address, business_hours, shipping_info, privacy_url,
              terms_url, exchange_url, size_guide, seo_title, seo_description,
              low_stock_threshold, reservation_hours, published)
  on public.store_settings to authenticated;
create policy settings_public_read on public.store_settings for select to anon, authenticated
  using (public.tenant_is_public(tenant_id) or public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy settings_admin_update on public.store_settings for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']));
-- Observação: anon não recebe low_stock_threshold/reservation_hours (colunas internas).
-- authenticated recebe todas as colunas, mas a policy já limita a lojas públicas ou do membro.

-- ------------------------------------------------------------- categories
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
create policy categories_read on public.categories for select to anon, authenticated
  using ((active and public.tenant_is_public(tenant_id)) or public.is_tenant_member(tenant_id)
         or public.is_platform_admin());
create policy categories_write on public.categories for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin','staff']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin','staff']));

-- --------------------------------------------------------------- products
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
create policy products_read on public.products for select to anon, authenticated
  using ((status = 'published' and archived_at is null and public.tenant_is_public(tenant_id))
         or public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy products_write on public.products for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin','staff']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin','staff']));

-- Custo: apenas membros (nunca a vitrine).
grant select, insert, update, delete on public.product_costs to authenticated;
create policy costs_member_all on public.product_costs for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']));

-- ---------------------------------------------------------- product_images
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
create policy images_read on public.product_images for select to anon, authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin() or exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'published' and p.archived_at is null
      and public.tenant_is_public(p.tenant_id)));
create policy images_write on public.product_images for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin','staff']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin','staff']));

-- -------------------------------------------------------- product_variants
-- stock_quantity NÃO é atualizável diretamente: só pelas funções adjust_stock/place_order.
grant select on public.product_variants to anon, authenticated;
grant insert on public.product_variants to authenticated;
grant update (sku, size, color, active) on public.product_variants to authenticated;
grant delete on public.product_variants to authenticated;
create policy variants_read on public.product_variants for select to anon, authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin() or (active and exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'published' and p.archived_at is null
      and public.tenant_is_public(p.tenant_id))));
create policy variants_write on public.product_variants for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin','staff']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin','staff']));

-- ---------------------------------------------------- inventory_movements
grant select on public.inventory_movements to authenticated;
create policy movements_read on public.inventory_movements for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

-- -------------------------------------------------------------- promotions
grant select on public.promotions to anon, authenticated;
grant insert, update, delete on public.promotions to authenticated;
create policy promotions_read on public.promotions for select to anon, authenticated
  using ((active and ends_at > now() and public.tenant_is_public(tenant_id))
         or public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy promotions_write on public.promotions for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']));

-- ------------------------------------------------------------------ orders
-- Pedidos são criados SOMENTE por place_order() (service role) e mudam de status
-- SOMENTE por change_order_status(). Valores, itens e histórico são imutáveis.
grant select on public.orders, public.order_items, public.order_status_history to authenticated;
grant update (notes) on public.orders to authenticated;
create policy orders_read on public.orders for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy orders_notes_update on public.orders for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin','staff']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin','staff']));
create policy order_items_read on public.order_items for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy order_history_read on public.order_status_history for select to authenticated
  using (public.is_tenant_member(tenant_id) or public.is_platform_admin());

-- ----------------------------------------------------------------- banners
grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;
create policy banners_read on public.banners for select to anon, authenticated
  using ((active and public.tenant_is_public(tenant_id))
         or public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy banners_write on public.banners for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']));

-- --------------------------------------------------------------- audit_log
grant select on public.audit_log to authenticated;
create policy audit_read on public.audit_log for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']) or public.is_platform_admin());

-- order_counters: sem acesso via API (usado só por place_order).

-- ------------------------------------------------------- views da vitrine
-- security_invoker: a view respeita o RLS de quem consulta.
create view public.catalog_products with (security_invoker = true) as
select
  p.id, p.tenant_id, p.category_id, p.name, p.slug, p.description, p.featured,
  p.created_at, p.regular_price,
  public.effective_price(p.id) as effective_price,
  (public.effective_price(p.id) < p.regular_price) as on_sale,
  case when p.regular_price > 0
       then round((1 - public.effective_price(p.id) / p.regular_price) * 100)::int
       else 0 end as discount_percent,
  exists (select 1 from public.product_variants v
          where v.product_id = p.id and v.active and v.stock_quantity > 0) as in_stock,
  coalesce((select array_agg(distinct v.size) from public.product_variants v
            where v.product_id = p.id and v.active and v.size is not null), '{}') as sizes,
  coalesce((select array_agg(distinct v.color) from public.product_variants v
            where v.product_id = p.id and v.active and v.color is not null), '{}') as colors,
  (select i.storage_path from public.product_images i
    where i.product_id = p.id order by i.is_primary desc, i.sort_order, i.created_at limit 1) as image_path
from public.products p
where p.status = 'published' and p.archived_at is null;

grant select on public.catalog_products to anon, authenticated;
