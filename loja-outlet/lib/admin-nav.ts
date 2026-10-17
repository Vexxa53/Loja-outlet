import type { Permission } from "./permissions";

export const ADMIN_NAV: [string, string, Permission | null][] = [
  ["/admin", "Dashboard", "reports.read"], ["/admin/produtos", "Produtos", "products.write"], ["/admin/categorias", "Categorias", "categories.write"],
  ["/admin/estoque", "Estoque", "stock.write"], ["/admin/pedidos", "Pedidos", "orders.read"], ["/admin/clientes", "Clientes", "customers.read"],
  ["/admin/cupons", "Cupons", "coupons.write"], ["/admin/banners", "Banners", "content.write"], ["/admin/config", "Configurações", "settings.write"],
  ["/admin/usuarios", "Usuários", "users.write"], ["/admin/auditoria", "Auditoria", "audit.read"],
];

