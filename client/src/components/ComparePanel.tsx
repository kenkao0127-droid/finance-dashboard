import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, LineSeries, type IChartApi } from "lightweight-charts";
import { trpc } from "@/lib/trpc";
import { ASSET_IDS, ASSET_META, TIME_RANGE_LABELS, type AssetId, type TimeRange } from "@shared/financeTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GitCompare } from "lucide-react";

const RANGES: TimeRange[] = ["1w", "1m", "3m", "6m", "1y", "3y", "10y"];
const COLORS = ["#6366f1", "#f59e0b", "#22c55e", "#ef4444", "#a855f7"];

export function ComparePanel() {
  const [range, setRange] = useState<TimeRange>("3m");
  const [selected, setSelected] = useState<Record<AssetId, boolean>>({
    "0050.TW": true, VOO: true, QQQM: true, GOLD_USD: false, USDTWD: false,
  });

  // Fixed 5 queries - always call all, enable/disable based on selection
  const q0050 = trpc.finance.history.useQuery({ assetId: "0050.TW", range }, { enabled: selected["0050.TW"], staleTime: 60_000 });
  const qVOO = trpc.finance.history.useQuery({ assetId: "VOO", range }, { enabled: selected.VOO, staleTime: 60_000 });
  const qQQQM = trpc.finance.history.useQuery({ assetId: "QQQM", range }, { enabled: selected.QQQM, staleTime: 60_000 });
  const qGold = trpc.finance.history.useQuery({ assetId: "GOLD_USD", range }, { enabled: selected.GOLD_USD, staleTime: 60_000 });
  const qFx = trpc.finance.history.useQuery({ assetId: "USDTWD", range }, { enabled: selected.USDTWD, staleTime: 60_000 });

  const queries: Record<AssetId, typeof q0050> = { "0050.TW": q0050, VOO: qVOO, QQQM: qQQQM, GOLD_USD: qGold, USDTWD: qFx };

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const buildChart = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(el, {
      width: el.clientWidth, height: 400,
      layout: { background: { color: "transparent" }, textColor: "#9ca3af", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)" },
    });
    chartRef.current = chart;

    let colorIdx = 0;
    for (const id of ASSET_IDS) {
      if (!selected[id]) continue;
      const pts = queries[id].data?.points;
      if (!pts || pts.length === 0) continue;

      // Normalize to percentage change from first point
      const base = pts[0].close;
      const normalized = pts.map(p => ({ time: p.time, value: ((p.close - base) / base) * 100 }));

      const series = chart.addSeries(LineSeries, { color: COLORS[colorIdx % COLORS.length], lineWidth: 2, lastValueVisible: true, priceLineVisible: false, title: ASSET_META[id].code });
      series.setData(normalized as any);
      colorIdx++;
    }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (el && chartRef.current) chartRef.current.applyOptions({ width: el.clientWidth }); });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [selected, range, q0050.data, qVOO.data, qQQQM.data, qGold.data, qFx.data]);

  useEffect(() => {
    const cleanup = buildChart();
    return () => { cleanup?.(); if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [buildChart]);

  const toggle = (id: AssetId) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

  const isLoading = ASSET_IDS.some(id => selected[id] && queries[id].isLoading);
  const hasData = ASSET_IDS.some(id => selected[id] && (queries[id].data?.points?.length ?? 0) > 0);

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">比較模式</CardTitle>
          <span className="text-xs text-muted-foreground ml-2">（漲跌幅 %）</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {ASSET_IDS.map((id, i) => (
            <label key={id} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={selected[id]} onCheckedChange={() => toggle(id)} />
              <span style={{ color: COLORS[i] }}>{ASSET_META[id].code}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap mt-2">
          {RANGES.map(r => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} className="h-7 text-xs px-2.5" onClick={() => setRange(r)}>
              {TIME_RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">載入中...</div>
        ) : !hasData ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">請選擇至少一項資產</div>
        ) : (
          <div ref={containerRef} className="w-full" />
        )}
      </CardContent>
    </Card>
  );
}
