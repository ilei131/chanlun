import { useRef, useState, useEffect, useMemo } from 'react';
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
    klineDates?: string[];
    visibleDateRange?: { start: string; end: string } | null;
}

export default function KdjChart({ dates, kdj, klineDates, visibleDateRange }: KdjChartProps) {
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
        if (!dates || dates.length === 0 || !kdj) return [];

        // 使用K线图日期作为主日期数组，确保对齐
        const mainDates = klineDates && klineDates.length > 0 ? klineDates : dates;
        
        // 创建KDJ数据的日期映射
        const kdjMap = new Map<string, { k: number; d: number; j: number }>();
        for (let i = 0; i < dates.length; i++) {
            kdjMap.set(dates[i].replace(/-/g, ''), {
                k: kdj.k[i] ?? 0,
                d: kdj.d[i] ?? 0,
                j: kdj.j[i] ?? 0,
            });
        }

        let displayDates: string[];
        let displayK: number[];
        let displayD: number[];
        let displayJ: number[];

        if (visibleDateRange) {
            const startDate = visibleDateRange.start.replace(/-/g, '');
            const endDate = visibleDateRange.end.replace(/-/g, '');
            const lastDate = mainDates[mainDates.length - 1].replace(/-/g, '');

            const filtered: { date: string; k: number; d: number; j: number }[] = [];
            for (let i = 0; i < mainDates.length; i++) {
                const itemDate = mainDates[i].replace(/-/g, '');
                // 确保最右侧数据始终显示
                if (itemDate >= startDate && (itemDate <= endDate || itemDate === lastDate)) {
                    const kdjData = kdjMap.get(itemDate);
                    filtered.push({
                        date: mainDates[i],
                        k: kdjData?.k ?? 0,
                        d: kdjData?.d ?? 0,
                        j: kdjData?.j ?? 0,
                    });
                }
            }

            displayDates = filtered.map(f => f.date);
            displayK = filtered.map(f => f.k);
            displayD = filtered.map(f => f.d);
            displayJ = filtered.map(f => f.j);
        } else {
            const maxPoints = 120;
            const startIdx = Math.max(0, mainDates.length - maxPoints);
            displayDates = mainDates.slice(startIdx);
            displayK = [];
            displayD = [];
            displayJ = [];
            for (let i = startIdx; i < mainDates.length; i++) {
                const itemDate = mainDates[i].replace(/-/g, '');
                const kdjData = kdjMap.get(itemDate);
                displayK.push(kdjData?.k ?? 0);
                displayD.push(kdjData?.d ?? 0);
                displayJ.push(kdjData?.j ?? 0);
            }
        }

        return displayDates.map((date, i) => ({
            name: date,
            k: Number(displayK[i]) || 0,
            d: Number(displayD[i]) || 0,
            j: Number(displayJ[i]) || 0,
        }));
    }, [dates, kdj, klineDates, visibleDateRange]);

    if (!dates || dates.length === 0 || !kdj) return null;
    if (containerSize.width <= 0 || containerSize.height <= 0) {
        return <div ref={containerRef} className="p-4" style={{ height: 250, width: '100%', minWidth: 300 }} />;
    }

    return (
        <div ref={containerRef} className="p-4" style={{ height: 250, width: '100%', minWidth: 300, boxSizing: 'border-box' }}>
            <ResponsiveContainer width={containerSize.width} height={containerSize.height - 32} minWidth={300} minHeight={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                    <XAxis
                        dataKey="name"
                        tick={{ fill: '#8b8fa3', fontSize: 10 }}
                        axisLine={{ stroke: '#2a2d3e' }}
                        tickLine={{ stroke: '#2a2d3e' }}
                        tickMargin={10}
                        interval={Math.floor(chartData.length / 5) - 1}
                    />
                    <YAxis
                        type="number"
                        domain={[-20, 120]}
                        ticks={[0, 20, 40, 60, 80, 100]}
                        allowDataOverflow
                        orientation="right"
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
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="d"
                        name="D"
                        stroke="#f59e0b"
                        dot={false}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="j"
                        name="J"
                        stroke="#d946ef"
                        dot={false}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
