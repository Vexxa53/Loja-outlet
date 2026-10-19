// Ícones simples (SVG inline, herdam a cor do texto).
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const IconSearch = () => (<svg {...base}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconHeart = ({ filled = false }: { filled?: boolean }) => (<svg {...base} fill={filled ? "currentColor" : "none"}><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.4 5 6.4 5c1.9 0 3.3 1 4.2 2.4h2.8C14.3 6 15.7 5 17.6 5c3 0 4.9 2.8 3.7 6.1-1.8 4.8-9.3 9.4-9.3 9.4Z" /></svg>);
export const IconUser = () => (<svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6" /></svg>);
export const IconBag = () => (<svg {...base}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>);
export const IconMenu = () => (<svg {...base}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const IconClose = () => (<svg {...base}><path d="m6 6 12 12M18 6 6 18" /></svg>);
export const IconChevron = () => (<svg {...base} width={16} height={16}><path d="m6 9 6 6 6-6" /></svg>);
export const IconTruck = () => (<svg {...base}><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>);
export const IconReturn = () => (<svg {...base}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>);
export const IconShield = () => (<svg {...base}><path d="M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IconChat = () => (<svg {...base}><path d="M4 5h16v11H9l-5 4V5Z" /></svg>);
