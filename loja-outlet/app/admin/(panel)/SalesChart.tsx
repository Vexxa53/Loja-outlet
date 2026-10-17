"use client";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function SalesChart({ data }: { data: { day: string; total: number; orders: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Gráfico de vendas por dia">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke="#2a2c31" vertical={false} />
          <XAxis dataKey="day" stroke="#9a9ea8" fontSize={12} />
          <YAxis stroke="#9a9ea8" fontSize={12} width={56} />
          <Tooltip contentStyle={{ background: "#1a1b1e", border: "1px solid #3a3d44" }} formatter={(v) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`} />
          <Line type="monotone" dataKey="total" stroke="#ffd400" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
