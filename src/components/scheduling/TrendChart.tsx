import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TrendPoint } from '../../types/scheduling';

interface Props { data: TrendPoint[] }

export function TrendChart({ data }: Props) {
  if (!data.length) return <p className="text-sm text-muted-foreground">Sem dados de tendência.</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="Novos"     stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Resolvidos" stroke="#22c55e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
