export const PERMISSIONS = {
  "products.write": "Gerenciar produtos",
  "categories.write": "Gerenciar categorias",
  "stock.write": "Gerenciar estoque",
  "orders.read": "Ver pedidos",
  "orders.write": "Atualizar pedidos",
  "customers.read": "Ver clientes",
  "customers.write": "Editar clientes e privacidade",
  "coupons.write": "Gerenciar cupons",
  "content.write": "Gerenciar banners e conteúdo",
  "settings.write": "Configurações da loja",
  "users.write": "Usuários e permissões",
  "reports.read": "Relatórios e dashboard",
  "audit.read": "Ver auditoria",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLES: { name: string; label: string; permissions: Permission[] }[] = [
  { name: "admin", label: "Administrador principal", permissions: ALL_PERMISSIONS },
  {
    name: "manager",
    label: "Gestor da loja",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "users.write"),
  },
  {
    name: "product_manager",
    label: "Gestor de produtos",
    permissions: ["products.write", "categories.write", "content.write", "reports.read"],
  },
  { name: "stockist", label: "Estoquista", permissions: ["stock.write", "orders.read"] },
  {
    name: "support",
    label: "Atendimento",
    permissions: ["orders.read", "customers.read", "customers.write"],
  },
  {
    name: "order_operator",
    label: "Operador de pedidos",
    permissions: ["orders.read", "orders.write"],
  },
  { name: "analyst", label: "Analista de relatórios", permissions: ["reports.read", "orders.read"] },
];

export function hasPermission(perms: readonly string[], p: Permission): boolean {
  return perms.includes(p);
}
