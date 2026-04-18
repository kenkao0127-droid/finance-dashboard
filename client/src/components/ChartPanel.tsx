import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createChart, LineSeries, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { trpc } from "@/lib/trpc";
import { ASSET_IDS, ASSET_META, TIME_RANGE_LABELS, type AssetId, type TimeRange, type HistoryPoint } from "@shared/financeTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";

const RANGES: TimeRange[] = ["1w", "1m", "3m", "6m", "1y", "3y", "10y"];
const MA_COLORS = { 5: "#f59e0b", 20: "#3b82f6", 60: "#a855f7" };

function calcMA(data: HistoryPoint[], period: number): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

export function ChartPanel() {
  const [assetId, setAssetId] = useState<AssetId>("0050.TW");
  const [range, setRange] = useState<TimeRange>("3m");
  const [chartType, setChartType] = useState<"line" | "candle">("candle");
  const [showMA, setShowMA] = useState<Record<number, boolean>>({ 5: false, 20: true, 60: false });

  const { data, isLoading } = trpc.finance.history.useQuery({ assetId, range }, { staleTime: 60_000 });
  const points = data?.points ?? [];

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const buildChart = useCallback(() => {
    const el = containerRef.current;
    if (!el || points.length === 0) return;

    // Clean up previous chart
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 420,
      layout: { background: { color: "transparent" }, textColor: "#9ca3af", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: range === "1w" },
    });
    chartRef.current = chart;

    if (chartType === "candle") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#ef4444", downColor: "#22c55e", borderUpColor: "#ef4444", borderDownColor: "#22c55e",
        wickUpColor: "#ef4444", wickDownColor: "#22c55e",
      });
      series.setData(points.map(p => ({ time: p.time, open: p.open, high: p.high, low: p.low, close: p.close })) as any);
    } else {
      const series = chart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 2 });
      series.setData(points.map(p => ({ time: p.time, value: p.close })) as any);
    }

    // MA lines
    for (const period of [5, 20, 60] as const) {
      if (showMA[period] && points.length >= period) {
        const maData = calcMA(points, period);
        const maSeries = chart.addSeries(LineSeries, { color: MA_COLORS[period], lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
        maSeries.setData(maData as any);
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => { if (el && chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth }); };
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [points, chartType, showMA, range]);

  useEffect(() => {
    const cleanup = buildChart();
    return () => { cleanup?.(); if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [buildChart]);

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">走勢圖表</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={assetId} onValueChange={(v) => setAssetId(v as AssetId)}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSET_IDS.map(id => <SelectItem key={id} value={id}>{ASSET_META[id].code}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button size="sm" variant={chartType === "candle" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setChartType("candle")}>K線</Button>
              <Button size="sm" variant={chartType === "line" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setChartType("line")}>線圖</Button>
            </div>
          </div>
        </div>
        {/* Time range buttons */}
        <div className="flex gap-1 flex-wrap mt-2">
          {RANGES.map(r => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} className="h-7 text-xs px-2.5" onClick={() => setRange(r)}>
              {TIME_RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
        {/* MA toggles */}
        <div className="flex gap-2 mt-2">
          {([5, 20, 60] as const).map(p => (
            <Button key={p} size="sm" variant={showMA[p] ? "default" : "outline"} className="h-6 text-xs px-2"
              style={showMA[p] ? { backgroundColor: MA_COLORS[p], borderColor: MA_COLORS[p] } : {}}
              onClick={() => setShowMA(prev => ({ ...prev, [p]: !prev[p] }))}>
              MA{p}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-[420px] flex items-center justify-center text-muted-foreground">載入中...</div>
        ) : points.length === 0 ? (
          <div className="h-[420px] flex items-center justify-center text-muted-foreground">暫無資料</div>
        ) : (
          <div ref={containerRef} className="w-full" />
        )}
      </CardContent>
    </Card>
  );
}
