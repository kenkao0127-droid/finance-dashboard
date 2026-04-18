import { ASSET_META, type QuoteData } from "@shared/financeTypes";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, BarChart3, Activity, Coins, ArrowLeftRight, Minus } from "lucide-react";

const ICONS: Record<string, React.FC<{ className?: string }>> = { BarChart3, TrendingUp, Activity, Coins, ArrowLeftRight };

function formatNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }); } catch { return ""; }
}

function marketLabel(state?: string) {
  switch (state) {
    case "REGULAR": return { text: "交易中", color: "text-green-400" };
    case "PRE": return { text: "盤前", color: "text-amber-400" };
    case "POST": return { text: "盤後", color: "text-amber-400" };
    case "CLOSING": return { text: "收盤競價", color: "text-amber-400" };
    default: return { text: "收盤", color: "text-muted-foreground" };
  }
}

export function QuoteCard({ quote }: { quote: QuoteData }) {
  const meta = ASSET_META[quote.assetId];
  const Icon = ICONS[meta.icon] || BarChart3;
  const isUp = quote.change > 0;
  const isDown = quote.change < 0;
  const isGold = meta.type === "gold";
  const isFx = meta.type === "fx";
  const market = marketLabel(quote.marketState);

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">{meta.code}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{meta.name}</p>
            </div>
          </div>
          <span className={`text-xs ${market.color}`}>{market.text}</span>
        </div>

        {isGold || isFx ? (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">{isFx ? "買入" : "買進"}</span>
              <span className="text-lg font-mono font-bold text-foreground">{quote.buyPrice?.toFixed(isFx ? 3 : 2)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">賣出</span>
              <span className="text-lg font-mono font-bold text-foreground">{quote.sellPrice?.toFixed(isFx ? 3 : 2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>{isGold ? "USD / 英兩" : ""}</span>
              <span>{meta.currency}</span>
            </div>
            <div className="text-xs text-muted-foreground text-right">{formatTime(quote.updatedAt)}</div>
          </div>
        ) : (
          <div>
            <p className="text-2xl font-mono font-bold text-foreground tracking-tight">{quote.price.toFixed(2)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {isUp ? <TrendingUp className="h-3.5 w-3.5 text-up" /> : isDown ? <TrendingDown className="h-3.5 w-3.5 text-down" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className={`text-sm font-mono font-medium ${isUp ? "text-up" : isDown ? "text-down" : "text-muted-foreground"}`}>
                {isUp ? "+" : ""}{quote.change.toFixed(2)} ({isUp ? "+" : ""}{quote.changePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
              {quote.volume ? <span>量 {formatNum(quote.volume)}</span> : <span />}
              <span>{formatTime(quote.updatedAt)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
