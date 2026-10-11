-- Vexxa360° Sites — 0001: esquema principal (multi-tenant)
-- Regras gerais:
--  * dinheiro sempre em numeric(12,2) (nunca float);
--  * todo registro de loja carrega tenant_id e as relações são COMPOSTAS
--    (tenant_id, id) para impedir vínculo entre lojas diferentes;
--  * RLS e privilégios ficam na migração 0002.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- utilitários
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ------------------------------------------------------------------- tenants
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  slug        text not null unique
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  status      text not null default 'active' check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_tenants_updated before update on public.tenants
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando um usuário é criado no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- memberships
-- Vínculo usuário ↔ loja. Só pode ser alterado pelo painel master (service role)
-- ou por SQL administrativo: nenhum usuário altera o próprio papel.
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'staff')),
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Administradores da plataforma (área master). Sem policy de escrita para
-- usuários: só service role / SQL do projeto.
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------- tenant_domains
create table public.tenant_domains (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  hostname    text not null unique check (hostname = lower(hostname) and hostname ~ '^[a-z0-9.-]+$'),
  status      text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  created_at  timestamptz not null default now()
);
create index tenant_domains_tenant_idx on public.tenant_domains (tenant_id);

-- ----------------------------------------------------------- store_settings
create table public.store_settings (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null unique references public.tenants (id) on delete cascade,
  store_name           text not null check (char_length(store_name) between 2 and 120),
  description          text check (char_length(description) <= 1000),
  logo_path            text,
  primary_color        text not null default '#111111' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color      text not null default '#b08968' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  whatsapp             text check (whatsapp ~ '^[0-9]{10,15}$'),   -- só dígitos, com DDI (ex.: 5511999998888)
  contact_email        text check (char_length(contact_email) <= 200),
  instagram            text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  address              text check (char_length(address) <= 300),
  business_hours       text check (char_length(business_hours) <= 300),
  shipping_info        text check (char_length(shipping_info) <= 1000),
  privacy_url          text check (privacy_url ~ '^https://'),
  terms_url            text check (terms_url ~ '^https://'),
  exchange_url         text check (exchange_url ~ '^https://'),
  size_guide           text check (char_length(size_guide) <= 4000),
  seo_title            text check (char_length(seo_title) <= 70),
  seo_description      text check (char_length(seo_description) <= 200),
  low_stock_threshold  integer not null default 3 check (low_stock_threshold >= 0),
  reservation_hours    integer not null default 48 check (reservation_hours between 1 and 720),
  published            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_store_settings_updated before update on public.store_settings
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- categories
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text check (char_length(description) <= 500),
  image_path   text,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, slug)
);

-- ----------------------------------------------------------------- products
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants (id) on delete cascade,
  category_id       uuid,
  name              text not null check (char_length(name) between 1 and 160),
  slug              text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description       text check (char_length(description) <= 5000),
  sku               text check (char_length(sku) <= 60),
  regular_price     numeric(12,2) not null check (regular_price >= 0),
  promotional_price numeric(12,2) check (promotional_price >= 0),
  status            text not null default 'draft' check (status in ('draft', 'published')),
  featured          boolean not null default false,
  composition       text check (char_length(composition) <= 500),
  care_instructions text check (char_length(care_instructions) <= 1000),
  size_guide        text check (char_length(size_guide) <= 4000),
  weight_grams      integer check (weight_grams >= 0),
  length_cm         numeric(8,2) check (length_cm >= 0),
  width_cm          numeric(8,2) check (width_cm >= 0),
  height_cm         numeric(8,2) check (height_cm >= 0),
  tags              text[] not null default '{}' check (cardinality(tags) <= 20),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, slug),
  check (promotional_price is null or promotional_price < regular_price),
  -- composta: a categoria precisa ser da MESMA loja; ao apagar a categoria só category_id vira null
  foreign key (tenant_id, category_id) references public.categories (tenant_id, id)
    on delete set null (category_id)
);
create unique index products_tenant_sku_uq on public.products (tenant_id, sku) where sku is not null;
create index products_tenant_status_idx on public.products (tenant_id, status) where archived_at is null;
create index products_tenant_category_idx on public.products (tenant_id, category_id);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- Custo de aquisição fica em tabela própria: o papel "anon/authenticated" lê
-- produtos publicados de qualquer loja (vitrine) e nunca pode enxergar o custo.
create table public.product_costs (
  product_id  uuid primary key,
  tenant_id   uuid not null,
  cost_price  numeric(12,2) not null check (cost_price >= 0),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade
);

-------------------------------------------------------------- product_images
create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  product_id    uuid not null,
  storage_path  text not null,
  alt_text      text check (char_length(alt_text) <= 200),
  sort_order    integer not null default 0,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade,
  -- o arquivo precisa estar na pasta da própria loja
  check (storage_path like tenant_id::text || '/%')
);
create index product_images_product_idx on public.product_images (product_id, sort_order);
create unique index product_images_one_primary_uq on public.product_images (product_id) where is_primary;

------------------------------------------------------------ product_variants
create table public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  product_id      uuid not null,
  sku             text check (char_length(sku) <= 60),
  size            text check (char_length(size) <= 20),
  color           text check (char_length(color) <= 40),
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade
);
create unique index variants_combo_uq
  on public.product_variants (product_id, coalesce(size, ''), coalesce(color, ''));
create unique index variants_tenant_sku_uq on public.product_variants (tenant_id, sku) where sku is not null;
create index variants_product_idx on public.product_variants (product_id);

-- Todo estoque inicial gera uma movimentação (auditoria completa).
------------------------------------------------------------ inventory_movements
create table public.inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  variant_id     uuid,
  movement_type  text not null
                 check (movement_type in ('initial', 'entry', 'adjustment', 'reservation', 'return', 'loss')),
  quantity       integer not null check (quantity <> 0),   -- com sinal: negativo = saída
  reason         text check (char_length(reason) <= 300),
  order_id       uuid,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (tenant_id, variant_id) references public.product_variants (tenant_id, id)
    on delete set null (variant_id)
);
create index inventory_movements_tenant_idx on public.inventory_movements (tenant_id, created_at desc);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

create or replace function public.log_initial_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock_quantity > 0 then
    insert into public.inventory_movements (tenant_id, variant_id, movement_type, quantity, reason, created_by)
    values (new.tenant_id, new.id, 'initial', new.stock_quantity, 'Estoque inicial', auth.uid());
  end if;
  return new;
end $$;
create trigger trg_variants_initial_stock after insert on public.product_variants
  for each row execute function public.log_initial_stock();

------------------------------------------------------------------ promotions
create table public.promotions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  product_id      uuid,                                   -- null = toda a loja
  discount_type   text not null check (discount_type in ('percent', 'amount_off', 'fixed_price')),
  discount_value  numeric(12,2) not null check (discount_value > 0),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  check (discount_type <> 'percent' or discount_value <= 90),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade
);
create index promotions_tenant_idx on public.promotions (tenant_id, active, starts_at, ends_at);

-- ------------------------------------------------------------------- orders
create table public.order_counters (
  tenant_id   uuid primary key references public.tenants (id) on delete cascade,
  last_number integer not null default 0
);

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  order_number    integer not null,
  customer_name   text not null check (char_length(customer_name) between 2 and 120),
  customer_phone  text not null check (customer_phone ~ '^[0-9]{10,15}$'),
  customer_email  text check (char_length(customer_email) <= 200),
  status          text not null default 'new'
                  check (status in ('new', 'awaiting_confirmation', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled')),
  subtotal        numeric(12,2) not null check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total           numeric(12,2) not null check (total >= 0),
  source          text not null default 'whatsapp' check (source in ('whatsapp', 'manual')),
  notes           text check (char_length(notes) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, order_number),
  check (total = subtotal - discount_amount)
);
create index orders_tenant_created_idx on public.orders (tenant_id, created_at desc);
create index orders_tenant_status_idx on public.orders (tenant_id, status);
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  order_id              uuid not null,
  product_id            uuid,
  variant_id            uuid,
  product_name_snapshot text not null,
  sku_snapshot          text,
  size_snapshot         text,
  color_snapshot        text,
  quantity              integer not null check (quantity > 0),
  regular_unit_price    numeric(12,2) not null check (regular_unit_price >= 0),
  unit_price            numeric(12,2) not null check (unit_price >= 0),
  line_total            numeric(12,2) not null check (line_total >= 0),
  check (line_total = unit_price * quantity),
  foreign key (tenant_id, order_id) references public.orders (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
    on delete set null (product_id),
  foreign key (tenant_id, variant_id) references public.product_variants (tenant_id, id)
    on delete set null (variant_id)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  order_id         uuid not null,
  previous_status  text,
  new_status       text not null,
  changed_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (tenant_id, order_id) references public.orders (tenant_id, id) on delete cascade
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ------------------------------------------------------------------ banners
create table public.banners (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  subtitle         text check (char_length(subtitle) <= 240),
  image_path       text not null,
  button_label     text check (char_length(button_label) <= 40),
  destination_url  text check (destination_url ~ '^(/|https://)'),
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  check (image_path like tenant_id::text || '/%')
);
create index banners_tenant_idx on public.banners (tenant_id, active, sort_order);

-- --------------------------------------------------------------- audit_log
create table public.audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid,
  user_id     uuid,
  action      text not null,           -- insert | update | delete
  entity      text not null,
  entity_id   text,
  created_at  timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);

-- Auditoria genérica (sem gravar conteúdo sensível — só quem, o quê e quando).
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  insert into public.audit_log (tenant_id, user_id, action, entity, entity_id)
  values (
    case when tg_table_name = 'tenants' then (to_jsonb(r) ->> 'id')::uuid
         else (to_jsonb(r) ->> 'tenant_id')::uuid end,
    auth.uid(), lower(tg_op), tg_table_name, to_jsonb(r) ->> 'id'
  );
  return r;
end $$;

create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.audit_row();
create trigger audit_store_settings after update on public.store_settings
  for each row execute function public.audit_row();
create trigger audit_promotions after insert or update or delete on public.promotions
  for each row execute function public.audit_row();
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.audit_row();
create trigger audit_banners after insert or update or delete on public.banners
  for each row execute function public.audit_row();
create trigger audit_memberships after insert or update or delete on public.memberships
  for each row execute function public.audit_row();
create trigger audit_tenants after insert or update on public.tenants
  for each row execute function public.audit_row();
