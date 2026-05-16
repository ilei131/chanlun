import { useRef, useState, useEffect } from 'react';
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

  if (!dates || dates.length === 0 || !kdj) return null;

  const maxPoints = 120;
  const startIdx = Math.max(0, dates.length - maxPoints);
  const displayDates = dates.slice(startIdx);
  const displayK = kdj.k.slice(startIdx);
  const displayD = kdj.d.slice(startIdx);
  const displayJ = kdj.j.slice(startIdx);

  const chartData = displayDates.map((date, i) => ({
    name: date,
    k: Number(displayK[i]) || 0,
    d: Number(displayD[i]) || 0,
    j: Number(displayJ[i]) || 0,
  }));

  return (
    <div ref={containerRef} className="p-4" style={{ height: 250, width: '100%' }}>
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
              domain={[-20, 120]}
              ticks={[0, 20, 40, 60, 80, 100]}
              allowDataOverflow
              tick={{ fill: '#8b8fa3', fontSize: 10 }}
              axisLine={{ stroke: '#2a2d3e' }}
              tickLine={{ stroke: '#2a2d3e' }}
              width={30}
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
      )}
    </div>
  );
}
