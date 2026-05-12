import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface MacdData {
  dates: string[];
  dif: number[];
  dea: number[];
  macd: number[];
}

interface MacdChartProps {
  macd: MacdData;
}

export default function MacdChart({ macd }: MacdChartProps) {
  if (!macd || !macd.dates || macd.dates.length === 0) return null;
  const dates = macd.dates;

  // Only show the last 120 data points for performance
  const maxPoints = 120;
  const startIdx = Math.max(0, dates.length - maxPoints);
  const displayDates = dates.slice(startIdx);
  const displayDif = macd.dif.slice(startIdx);
  const displayDea = macd.dea.slice(startIdx);
  const displayMacd = macd.macd.slice(startIdx);

  const chartData = displayDates.map((date, i) => ({
    date,
    dif: displayDif[i] ?? 0,
    dea: displayDea[i] ?? 0,
    macd: displayMacd[i] ?? 0,
  }));

  return (
    <div className="p-4" style={{ height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8b8fa3', fontSize: 10 }}
            axisLine={{ stroke: '#2a2d3e' }}
            tickLine={{ stroke: '#2a2d3e' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#8b8fa3', fontSize: 10 }}
            axisLine={{ stroke: '#2a2d3e' }}
            tickLine={{ stroke: '#2a2d3e' }}
          />
          <Tooltip
            contentStyle={{
              background: '#1e2130',
              border: '1px solid #2a2d3e',
              borderRadius: 8,
              color: '#e4e6ef',
              fontSize: 12,
            }}
            labelStyle={{ color: '#8b8fa3' }}
          />
          <ReferenceLine y={0} stroke="#2a2d3e" />
          <Bar
            dataKey="macd"
            name="MACD"
            fill="#ef4444"
            fillOpacity={0.6}
            shape={(props: unknown) => {
              const p = props as { x: number; y: number; width: number; height: number; payload: { macd: number } };
              return (
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.width}
                  height={p.height}
                  fill={p.payload.macd >= 0 ? '#ef4444' : '#22c55e'}
                  opacity={0.6}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="dif"
            name="DIF"
            stroke="#f59e0b"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="dea"
            name="DEA"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={1.5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
