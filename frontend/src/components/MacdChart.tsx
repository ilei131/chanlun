import { useRef, useState, useEffect, useMemo } from 'react';
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
    visibleDateRange?: { start: string; end: string } | null;
}

export default function MacdChart({ macd, visibleDateRange }: MacdChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const { offsetWidth, offsetHeight } = containerRef.current;
                setContainerSize({ width: offsetWidth, height: offsetHeight });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const chartData = useMemo(() => {
        if (!macd || !macd.dates || macd.dates.length === 0) return [];

        const dates = macd.dates;

        let displayDates: string[];
        let displayDif: number[];
        let displayDea: number[];
        let displayMacd: number[];

        if (visibleDateRange) {
            const startDate = visibleDateRange.start.replace(/-/g, '');
            const endDate = visibleDateRange.end.replace(/-/g, '');

            const filtered: { date: string; dif: number; dea: number; macd: number }[] = [];
            for (let i = 0; i < dates.length; i++) {
                const itemDate = dates[i].replace(/-/g, '');
                if (itemDate >= startDate && itemDate <= endDate) {
                    filtered.push({
                        date: dates[i],
                        dif: macd.dif[i] ?? 0,
                        dea: macd.dea[i] ?? 0,
                        macd: macd.macd[i] ?? 0,
                    });
                }
            }

            displayDates = filtered.map(f => f.date);
            displayDif = filtered.map(f => f.dif);
            displayDea = filtered.map(f => f.dea);
            displayMacd = filtered.map(f => f.macd);
        } else {
            const maxPoints = 120;
            const startIdx = Math.max(0, dates.length - maxPoints);
            displayDates = dates.slice(startIdx);
            displayDif = macd.dif.slice(startIdx);
            displayDea = macd.dea.slice(startIdx);
            displayMacd = macd.macd.slice(startIdx);
        }

        return displayDates.map((date, i) => ({
            name: date,
            dif: Number(displayDif[i]) || 0,
            dea: Number(displayDea[i]) || 0,
            macd: Number(displayMacd[i]) || 0,
        }));
    }, [macd, visibleDateRange]);

    if (!macd || !macd.dates || macd.dates.length === 0) return null;
    if (containerSize.width <= 0 || containerSize.height <= 0) {
        return <div ref={containerRef} className="p-4" style={{ height: 250, width: '100%', minWidth: 300 }} />;
    }

    return (
        <div ref={containerRef} className="p-4" style={{ height: 250, width: '100%', minWidth: 300, boxSizing: 'border-box' }}>
            <ResponsiveContainer width={containerSize.width} height={containerSize.height - 32} minWidth={300} minHeight={200}>
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
                        isAnimationActive={false}
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
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="dea"
                        name="DEA"
                        stroke="#3b82f6"
                        dot={false}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
