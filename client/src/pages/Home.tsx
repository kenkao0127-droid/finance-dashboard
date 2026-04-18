import { useState, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { QuoteCard } from "@/components/QuoteCard";
import { ChartPanel } from "@/components/ChartPanel";
import { ComparePanel } from "@/components/ComparePanel";
import { NewsPanel } from "@/components/NewsPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Sun, Moon, Activity, Clock } from "lucide-react";
import type { QuoteData } from "@shared/financeTypes";

function formatDateTime(d: Date): string {
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function QuoteCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/40 bg-card/80 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-16 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
      </div>
      <div className="h-7 w-24 rounded bg-muted mb-2" />
      <div className="h-4 w-32 rounded bg-muted" />
    </div>
  );
}

export default function Home() {
  const { theme, toggleTheme, switchable } = useTheme();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mainTab, setMainTab] = useState("chart");

  const utils = trpc.useUtils();
  const { data: quotes, isLoading, refetch } = trpc.finance.quotes.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
  });

  useEffect(() => {
    if (quotes) setLastUpdated(new Date());
  }, [quotes]);

  const handleRefresh = useCallback(() => {
    refetch();
    utils.finance.quotes.invalidate();
  }, [refetch, utils]);

  const emptyQuotes: QuoteData[] = useMemo(() => [], []);
  const displayQuotes = quotes ?? emptyQuotes;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold text-foreground tracking-tight">金融資產即時看板</h1>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>最後更新：{formatDateTime(lastUpdated)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto refresh toggle */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <span>自動刷新</span>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
              {/* Manual refresh */}
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleRefresh}>
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline text-xs">重新整理</span>
              </Button>
              {/* Theme toggle */}
              {switchable && (
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={toggleTheme}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Quote Cards */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <QuoteCardSkeleton key={i} />)
              : displayQuotes.map(q => <QuoteCard key={q.assetId} quote={q} />)
            }
          </div>
        </section>

        {/* Chart / Compare / News tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="bg-secondary/40 h-auto gap-1 p-1">
            <TabsTrigger value="chart" className="text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">走勢圖表</TabsTrigger>
            <TabsTrigger value="compare" className="text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">比較模式</TabsTrigger>
            <TabsTrigger value="news" className="text-sm px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">新聞</TabsTrigger>
          </TabsList>
          <TabsContent value="chart" className="mt-4"><ChartPanel /></TabsContent>
          <TabsContent value="compare" className="mt-4"><ComparePanel /></TabsContent>
          <TabsContent value="news" className="mt-4"><NewsPanel /></TabsContent>
        </Tabs>
      </main>

      {/* Footer disclaimer */}
      <footer className="border-t border-border/40 bg-card/30 mt-8">
        <div className="container py-6">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            本網站資料僅供參考，非投資建議。市場資料可能有延遲或誤差，請以官方交易所或台灣銀行公布之牌價為準。
          </p>
          <p className="text-xs text-muted-foreground/50 text-center mt-2">
            時區：Asia/Taipei
          </p>
        </div>
      </footer>
    </div>
  );
}
