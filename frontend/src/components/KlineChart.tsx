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

interface ZsItem {
  start_date: string;
  end_date: string;
  zg: number;
  zd: number;
  height: number;
  mid: number;
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

    zsList.forEach((zs) => {
      const upperLine = chart.addLineSeries({
        color: 'rgba(59,130,246,0.3)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const lowerLine = chart.addLineSeries({
        color: 'rgba(59,130,246,0.3)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const startIdx = kline.findIndex((k) => k.date >= zs.start_date);
      const endIdx = kline.findIndex((k) => k.date >= zs.end_date);

      if (startIdx >= 0 && endIdx >= 0) {
          const slice = kline.slice(startIdx, endIdx + 1);
          if (slice.length > 0) {
            upperLine.setData(slice.map((k) => ({ time: formatDate(k.date) as Time, value: zs.zg })));
            lowerLine.setData(slice.map((k) => ({ time: formatDate(k.date) as Time, value: zs.zd })));
          }
        }
    });

    chart.timeScale().fitContent();

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
