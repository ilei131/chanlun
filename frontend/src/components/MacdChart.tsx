import { useRef, useState, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          setDimensions({ width: offsetWidth, height: offsetHeight });
        }
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (!macd || !macd.dates || macd.dates.length === 0) return null;

  const dates = macd.dates;
  const maxPoints = 120;
  const startIdx = Math.max(0, dates.length - maxPoints);
  const displayDates = dates.slice(startIdx);
  const displayDif = macd.dif.slice(startIdx);
  const displayDea = macd.dea.slice(startIdx);
  const displayMacd = macd.macd.slice(startIdx);

  const chartData = displayDates.map((date, i) => ({
    name: date,
    dif: Number(displayDif[i]) || 0,
    dea: Number(displayDea[i]) || 0,
    macd: Number(displayMacd[i]) || 0,
  }));

  return (
    <div ref={containerRef} className="p-4" style={{ height: 250, width: '100%' }}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#8b8fa3', fontSize: 10 }}
              axisLine={{ stroke: '#2a2d3e' }}
              tickLine={{ stroke: '#2a2d3e' }}
              interval={Math.floor(chartData.length / 5)}
            />
            <YAxis
              type="number"
              tick={{ fill: '#8b8fa3', fontSize: 10 }}
              axisLine={{ stroke: '#2a2d3e' }}
              tickLine={{ stroke: '#2a2d3e' }}
              tickFormatter={(value: number) => value.toFixed(2)}
              width={45}
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
                const isPositive = p.payload.macd >= 0;
                const height = Math.abs(p.height);
                const y = isPositive ? p.y : p.y - height;
                return (
                  <rect
                    x={p.x}
                    y={y}
                    width={p.width}
                    height={height}
                    fill={isPositive ? '#ef4444' : '#22c55e'}
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
      )}
    </div>
  );
}
