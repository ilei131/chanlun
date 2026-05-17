import { useEffect, useRef } from 'react';
import {
    createChart,
    ColorType,
    IChartApi,
    ISeriesApi,
    Time,
} from 'lightweight-charts';

export interface KlineData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface MaData {
    dates: string[];
    ma5: (number | null)[];
    ma10: (number | null)[];
    ma20: (number | null)[];
    ma60: (number | null)[];
}

interface BuySellPoint {
    date: string;
    type: string;
    price: number;
    reason?: string;
}

interface ZsBiItem {
    start_date: string;
    end_date: string;
    direction: string;
    high: number;
    low: number;
}

interface ZsItem {
    start_date: string;
    end_date: string;
    zg: number;
    zd: number;
    gg: number;
    dd: number;
    height: number;
    mid: number;
    bis: ZsBiItem[];
}

interface FenXingItem {
    date: string;
    price: number;
    direction: string;
}

interface KlineChartProps {
    kline: KlineData[];
    ma: MaData;
    buyPoints: BuySellPoint[];
    sellPoints: BuySellPoint[];
    zsList: ZsItem[];
    fxList: FenXingItem[];
}

export default function KlineChart({ kline, ma, buyPoints, sellPoints, zsList, fxList }: KlineChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current || kline.length === 0) return;

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        const container = chartContainerRef.current;
        const chart = createChart(container, {
            layout: {
                background: { type: ColorType.Solid, color: '#1e2130' },
                textColor: '#8b8fa3',
                fontSize: 12,
            },
            grid: {
                vertLines: { color: '#2a2d3e' },
                horzLines: { color: '#2a2d3e' },
            },
            crosshair: {
                mode: 0,
                vertLine: { color: '#3b82f6', width: 1, style: 2 },
                horzLine: { color: '#3b82f6', width: 1, style: 2 },
            },
            rightPriceScale: {
                borderColor: '#2a2d3e',
            },
            timeScale: {
                borderColor: '#2a2d3e',
                timeVisible: false,
            },
            width: container.clientWidth,
            height: 500,
        });

        chartRef.current = chart;

        const sortedKline = [...kline].sort((a, b) => a.date.localeCompare(b.date));

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#ef4444',
            downColor: '#22c55e',
            borderUpColor: '#ef4444',
            borderDownColor: '#22c55e',
            wickUpColor: '#ef4444',
            wickDownColor: '#22c55e',
        });

        const formatDate = (dateStr: string): string => {
            if (dateStr.length === 8) {
                return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
            }
            return dateStr;
        };

        const candleData = sortedKline.map((item) => ({
            time: formatDate(item.date) as Time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
        }));

        candlestickSeries.setData(candleData);

        const volumeSeries = chart.addHistogramSeries({
            color: '#3b82f6',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        const volumeData = sortedKline.map((item) => ({
            time: formatDate(item.date) as Time,
            value: item.volume,
            color: item.close >= item.open ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)',
        }));

        volumeSeries.setData(volumeData);

        const maColors: { key: keyof MaData; color: string; lineWidth: number }[] = [
            { key: 'ma5', color: '#f59e0b', lineWidth: 1 },
            { key: 'ma10', color: '#3b82f6', lineWidth: 1 },
            { key: 'ma20', color: '#a855f7', lineWidth: 1 },
            { key: 'ma60', color: '#22c55e', lineWidth: 1 },
        ];

        const maSeriesMap: Record<string, ISeriesApi<'Line'>> = {};
        const maDateMap = new Map(ma.dates.map((date, i) => [date, i]));

        maColors.forEach(({ key, color, lineWidth }) => {
            const series = chart.addLineSeries({
                color,
                lineWidth: lineWidth as 1 | 2 | 3 | 4,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });
            maSeriesMap[key] = series;

            const maData = sortedKline
                .map((k) => {
                    const idx = maDateMap.get(k.date);
                    if (idx === undefined) return null;
                    const val = ma[key][idx];
                    if (val === null || val === undefined) return null;
                    return { time: formatDate(k.date) as Time, value: val };
                })
                .filter(Boolean) as { time: Time; value: number }[];

            series.setData(maData);
        });

        const markers: { time: Time; position: 'belowBar' | 'aboveBar'; color: string; shape: 'arrowUp' | 'arrowDown'; text: string }[] = [];

        buyPoints.forEach((pt) => {
            markers.push({
                time: formatDate(pt.date) as Time,
                position: 'belowBar',
                color: '#ef4444',
                shape: 'arrowUp',
                text: pt.type,
            });
        });

        sellPoints.forEach((pt) => {
            markers.push({
                time: formatDate(pt.date) as Time,
                position: 'aboveBar',
                color: '#22c55e',
                shape: 'arrowDown',
                text: pt.type,
            });
        });

        fxList.forEach((fx) => {
            markers.push({
                time: formatDate(fx.date) as Time,
                position: fx.direction === 'top' ? 'aboveBar' : 'belowBar',
                color: fx.direction === 'top' ? '#f59e0b' : '#a855f7',
                shape: fx.direction === 'top' ? 'arrowDown' : 'arrowUp',
                text: fx.direction === 'top' ? '顶' : '底',
            });
        });

        markers.sort((a, b) => String(a.time).localeCompare(String(b.time)));

        if (markers.length > 0) {
            candlestickSeries.setMarkers(markers);
        }

        // 只绘制最近的一个中枢
        if (zsList.length > 0) {
            const zs = zsList[zsList.length - 1];
            
            // 绘制中枢区域背景
            const bgColor = 'rgba(59,130,246,0.15)';
            const bgSeries = chart.addHistogramSeries({
                color: bgColor,
                priceFormat: { type: 'volume' },
                priceScaleId: '',
            });

            // 绘制中枢上沿(ZG)和下沿(ZD)
            const zgLine = chart.addLineSeries({
                color: '#3b82f6',
                lineWidth: 2,
                lineStyle: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });

            const zdLine = chart.addLineSeries({
                color: '#3b82f6',
                lineWidth: 2,
                lineStyle: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });

            // 绘制中枢最高点(GG)和最低点(DD)
            const ggLine = chart.addLineSeries({
                color: '#ef4444',
                lineWidth: 1,
                lineStyle: 3,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });

            const ddLine = chart.addLineSeries({
                color: '#22c55e',
                lineWidth: 1,
                lineStyle: 3,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });

            const startIdx = kline.findIndex((k) => k.date >= zs.start_date);
            const endIdx = kline.findIndex((k) => k.date >= zs.end_date);

            if (startIdx >= 0 && endIdx >= 0) {
                const slice = kline.slice(startIdx, endIdx + 1);
                if (slice.length > 0) {
                    zgLine.setData(slice.map((k) => ({ time: formatDate(k.date) as Time, value: zs.zg })));
                    zdLine.setData(slice.map((k) => ({ time: formatDate(k.date) as Time, value: zs.zd })));
                    ggLine.setData(slice.map((k) => ({ time: formatDate(k.date) as Time, value: zs.gg })));
                    ddLine.setData(slice.map((k) => ({ time: formatDate(k.date) as Time, value: zs.dd })));

                    // 填充中枢区域
                    bgSeries.setData(slice.map((k) => ({
                        time: formatDate(k.date) as Time,
                        value: Math.abs(zs.zg - zs.zd),
                        color: bgColor,
                    })));
                    bgSeries.priceScale().applyOptions({
                        scaleMargins: { top: 0, bottom: 1 },
                        visible: false,
                    });

                    // 绘制中枢内的笔
                    zs.bis.forEach((bi) => {
                        const biColor = bi.direction === 'up' ? '#ef4444' : '#22c55e';
                        const biLine = chart.addLineSeries({
                            color: biColor,
                            lineWidth: 2,
                            lineStyle: 0,
                            priceLineVisible: false,
                            lastValueVisible: false,
                            crosshairMarkerVisible: false,
                        });

                        const biStartIdx = kline.findIndex((k) => k.date >= bi.start_date);
                        const biEndIdx = kline.findIndex((k) => k.date >= bi.end_date);

                        if (biStartIdx >= 0 && biEndIdx >= 0) {
                            // 使用笔数据中的实际高低点
                            const startPrice = bi.direction === 'up' ? bi.low : bi.high;
                            const endPrice = bi.direction === 'up' ? bi.high : bi.low;

                            const startTime = formatDate(kline[biStartIdx].date) as Time;
                            const endTime = formatDate(kline[biEndIdx].date) as Time;
                            
                            if (startTime === endTime) {
                                biLine.setData([{ time: startTime, value: startPrice }]);
                            } else if (startTime < endTime) {
                                biLine.setData([
                                    { time: startTime, value: startPrice },
                                    { time: endTime, value: endPrice },
                                ]);
                            } else {
                                biLine.setData([
                                    { time: endTime, value: endPrice },
                                    { time: startTime, value: startPrice },
                                ]);
                            }
                        }
                    });
                }
            }
        }

        chart.timeScale().fitContent();

        let prevRightEdge: number = candleData.length - 1;
        let prevBarCount: number | null = null;
        let skipNext = false;

        const initialRange = chart.timeScale().getVisibleLogicalRange();
        if (initialRange) {
            prevBarCount = initialRange.to - initialRange.from;
            prevRightEdge = initialRange.to;
        }

        const lastBarIndex = candleData.length - 1;

        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (!range) return;

            if (skipNext) {
                skipNext = false;
                return;
            }

            const barCount = range.to - range.from;

            if (prevBarCount !== null && Math.abs(barCount - prevBarCount) > 0.5) {
                skipNext = true;
                chart.timeScale().setVisibleLogicalRange({
                    from: prevRightEdge - barCount,
                    to: prevRightEdge,
                });
                prevBarCount = barCount;
            } else {
                if (range.to > lastBarIndex + 0.5) {
                    skipNext = true;
                    chart.timeScale().setVisibleLogicalRange({
                        from: lastBarIndex - barCount,
                        to: lastBarIndex,
                    });
                    prevRightEdge = lastBarIndex;
                } else {
                    prevRightEdge = range.to;
                }
                prevBarCount = barCount;
            }
        });

        const handleResize = () => {
            if (container) {
                chart.applyOptions({ width: container.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, [kline, ma, buyPoints, sellPoints, zsList, fxList]);

    return <div ref={chartContainerRef} className="w-full" />;
}
