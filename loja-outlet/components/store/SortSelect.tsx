"use client";
import { useRouter } from "next/navigation";

export function SortSelect({ base, current, options }: { base: Record<string, string>; current: string; options: [string, string][] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-mute">Ordenar por</span>
      <select value={current} aria-label="Ordenar por" className="input !w-auto" onChange={(e) => {
        const u = new URLSearchParams(base);
        if (e.target.value) u.set("ordem", e.target.value);
        const q = u.toString();
        router.push(q ? `/produtos?${q}` : "/produtos");
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
