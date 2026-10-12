// Tipos das linhas usadas pela aplicação (espelham as migrações em supabase/migrations).
export type Role = "owner" | "admin" | "staff";

export type Tenant = { id: string; name: string; slug: string; status: "active" | "suspended" };

export type StoreSettings = {
  id: string;
  tenant_id: string;
  store_name: string;
  description: string | null;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  whatsapp: string | null;
  contact_email: string | null;
  instagram: string | null;
  address: string | null;
  business_hours: string | null;
  shipping_info: string | null;
  privacy_url: string | null;
  terms_url: string | null;
  exchange_url: string | null;
  size_guide: string | null;
  seo_title: string | null;
  seo_description: string | null;
  low_stock_threshold?: number;
  reservation_hours?: number;
  published: boolean;
};

export type Category = {
  id: string; tenant_id: string; name: string; slug: string; description: string | null;
  image_path: string | null; active: boolean; sort_order: number;
};

export type Product = {
  id: string; tenant_id: string; category_id: string | null; name: string; slug: string;
  description: string | null; sku: string | null; regular_price: number; promotional_price: number | null;
  status: "draft" | "published"; featured: boolean; composition: string | null;
  care_instructions: string | null; size_guide: string | null; weight_grams: number | null;
  length_cm: number | null; width_cm: number | null; height_cm: number | null; tags: string[];
  created_at: string; updated_at: string; archived_at: string | null;
};

export type Variant = {
  id: string; tenant_id: string; product_id: string; sku: string | null; size: string | null;
  color: string | null; stock_quantity: number; active: boolean;
};

export type ProductImage = {
  id: string; tenant_id: string; product_id: string; storage_path: string; alt_text: string | null;
  sort_order: number; is_primary: boolean;
};

export type CatalogProduct = {
  id: string; tenant_id: string; category_id: string | null; name: string; slug: string;
  description: string | null; featured: boolean; created_at: string; regular_price: number;
  effective_price: number; on_sale: boolean; discount_percent: number; in_stock: boolean;
  sizes: string[]; colors: string[]; image_path: string | null;
};

export type Banner = {
  id: string; tenant_id: string; title: string; subtitle: string | null; image_path: string;
  button_label: string | null; destination_url: string | null; active: boolean; sort_order: number;
};

export type Promotion = {
  id: string; tenant_id: string; name: string; product_id: string | null;
  discount_type: "percent" | "amount_off" | "fixed_price"; discount_value: number;
  starts_at: string; ends_at: string; active: boolean;
};

export type Order = {
  id: string; tenant_id: string; order_number: number; customer_name: string; customer_phone: string;
  customer_email: string | null; status: string; subtotal: number; discount_amount: number; total: number;
  source: string; notes: string | null; created_at: string; updated_at: string;
};

export type OrderItem = {
  id: string; order_id: string; product_id: string | null; variant_id: string | null;
  product_name_snapshot: string; sku_snapshot: string | null; size_snapshot: string | null;
  color_snapshot: string | null; quantity: number; regular_unit_price: number; unit_price: number; line_total: number;
};

export type DashboardStats = {
  total_products: number; published_products: number; promo_products: number;
  low_stock_products: number; out_of_stock_products: number; orders_new: number;
  orders_in_progress: number; orders_completed: number; orders_cancelled: number; revenue: number;
  top_products: { name: string; quantity: number; revenue: number }[];
};
