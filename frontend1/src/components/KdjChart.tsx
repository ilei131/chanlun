import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface KdjData {
  k: number[];
  d: number[];
  j: number[];
}

interface KdjChartProps {
  dates: string[];
  kdj: KdjData;
}

export default function KdjChart({ dates, kdj }: KdjChartProps) {
  if (!dates || dates.length === 0 || !kdj) return null;

  // Only show the last 120 data points for performance
  const maxPoints = 120;
  const startIdx = Math.max(0, dates.length - maxPoints);
  const displayDates = dates.slice(startIdx);
  const displayK = kdj.k.slice(startIdx);
  const displayD = kdj.d.slice(startIdx);
  const displayJ = kdj.j.slice(startIdx);

  const chartData = displayDates.map((date, i) => ({
    date,
    k: displayK[i] ?? 0,
    d: displayD[i] ?? 0,
    j: displayJ[i] ?? 0,
  }));

  return (
    <div className="p-4" style={{ height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8b8fa3', fontSize: 10 }}
            axisLine={{ stroke: '#2a2d3e' }}
            tickLine={{ stroke: '#2a2d3e' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
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
          <ReferenceLine y={80} stroke="#2a2d3e" strokeDasharray="3 3" />
          <ReferenceLine y={20} stroke="#2a2d3e" strokeDasharray="3 3" />
          <ReferenceLine y={50} stroke="#2a2d3e" />
          <Line
            type="monotone"
            dataKey="k"
            name="K"
            stroke="#e4e6ef"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="d"
            name="D"
            stroke="#f59e0b"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="j"
            name="J"
            stroke="#d946ef"
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
