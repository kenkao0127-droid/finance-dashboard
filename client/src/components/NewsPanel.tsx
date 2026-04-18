import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ASSET_IDS, ASSET_META, type AssetId } from "@shared/financeTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Newspaper, ExternalLink, Clock } from "lucide-react";

const TAB_LABELS: Record<AssetId, string> = {
  "0050.TW": "0050",
  VOO: "VOO",
  QQQM: "QQQM",
  GOLD_USD: "黃金",
  USDTWD: "匯率",
};

function NewsTab({ assetId }: { assetId: AssetId }) {
  const { data, isLoading } = trpc.finance.news.useQuery({ assetId }, { staleTime: 5 * 60_000 });
  const items = data?.items ?? [];

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">載入新聞中...</div>;
  if (items.length === 0) return <div className="py-8 text-center text-muted-foreground text-sm">最近三天內暫無相關新聞</div>;

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
      {items.map((item, i) => (
        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
          className="block p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors border border-transparent hover:border-primary/20">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-2">{item.title}</h4>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          </div>
          {item.summary && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.summary}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {item.source && <span className="text-primary/70">{item.source}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatRelativeTime(item.publishedAt)}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "剛剛";
    if (hours < 24) return `${hours} 小時前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  } catch { return ""; }
}

export function NewsPanel() {
  const [tab, setTab] = useState<string>("0050.TW");

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">最新新聞</CardTitle>
          <span className="text-xs text-muted-foreground ml-2">（最近三天）</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary/40 mb-3 flex-wrap h-auto gap-1 p-1">
            {ASSET_IDS.map(id => (
              <TabsTrigger key={id} value={id} className="text-xs px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {TAB_LABELS[id]}
              </TabsTrigger>
            ))}
          </TabsList>
          {ASSET_IDS.map(id => (
            <TabsContent key={id} value={id}>
              <NewsTab assetId={id} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
