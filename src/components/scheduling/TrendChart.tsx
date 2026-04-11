import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrendPoint } from '../../types/scheduling';

interface Props { data: TrendPoint[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export function TrendChart({ data }: Props) {
  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sem dados de tendência disponíveis.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(150 15% 20%)"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(140 10% 60%)' }}
          tickLine={false}
          axisLine={{ stroke: 'hsl(150 15% 24%)' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(140 10% 60%)' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'hsl(140 10% 70%)' }}
        />
        <Line
          type="monotone"
          dataKey="Novos"
          stroke="hsl(217 91% 60%)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'hsl(217 91% 60%)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="Resolvidos"
          stroke="hsl(151 60% 45%)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'hsl(151 60% 45%)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
