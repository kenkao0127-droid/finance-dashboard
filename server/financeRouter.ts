import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { callDataApi } from "./_core/dataApi";
import { fetchBotGoldPrice, fetchBotFxRate } from "./botScraper";
import {
  ASSET_IDS,
  TIME_RANGE_TO_YAHOO,
  type AssetId,
  type QuoteData,
  type HistoryPoint,
  type NewsItem,
  type TimeRange,
} from "../shared/financeTypes";
import { parseStringPromise } from "xml2js";

/** Determine market state based on Asia/Taipei time */
function getMarketState(market: 'TW' | 'US' | 'GOLD' | 'FX'): string {
  const now = new Date();
  const taipeiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const hour = taipeiTime.getHours();
  const minute = taipeiTime.getMinutes();
  const day = taipeiTime.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  const t = hour * 60 + minute; // minutes since midnight

  if (market === 'TW') {
    // TWSE: Mon-Fri 09:00-13:30 Taipei time
    if (isWeekend) return 'CLOSED';
    if (t >= 830 && t < 840) return 'POST'; // 13:50-14:00 post-market
    if (t >= 810 && t < 830) return 'CLOSING'; // 13:30-13:50 closing auction
    if (t >= 540 && t < 810) return 'REGULAR'; // 09:00-13:30
    if (t >= 520 && t < 540) return 'PRE'; // 08:40-09:00 pre-market
    return 'CLOSED';
  }
  if (market === 'US') {
    // US markets in Taipei time (approximate, covers both EST and EDT):
    // Regular: ~21:30-04:00 (winter) or ~22:30-05:00 (summer)
    // Pre-market: ~16:00-21:30 or ~17:00-22:30
    // After-hours: ~04:00-08:00 or ~05:00-09:00
    if (isWeekend) return 'CLOSED';
    // Conservative regular session window: 21:30-05:00 Taipei
    if (t >= 1290 || t < 300) return 'REGULAR'; // 21:30-05:00
    // Pre-market: 16:00-21:30 Taipei
    if (t >= 960 && t < 1290) return 'PRE';
    // After-hours: 05:00-08:00 Taipei
    if (t >= 300 && t < 480) return 'POST';
    return 'CLOSED';
  }
  if (market === 'GOLD' || market === 'FX') {
    // Bank of Taiwan: Mon-Fri 09:00-15:30
    if (isWeekend) return 'CLOSED';
    if (t >= 540 && t <= 930) return 'REGULAR'; // 09:00-15:30
    return 'CLOSED';
  }
  return 'CLOSED';
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchYahooChart(symbol: string, range: string, interval: string) {
  return callDataApi("YahooFinance/get_stock_chart", {
    query: { symbol, region: symbol.endsWith(".TW") ? "TW" : "US", interval, range, includeAdjustedClose: "true" },
  }) as Promise<any>;
}

async function fetchEtfQuote(symbol: string): Promise<QuoteData> {
  const assetId = symbol as AssetId;
  try {
    const data = await fetchYahooChart(symbol, "1d", "1d");
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("No meta data");
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const pct = prevClose ? (change / prevClose) * 100 : 0;
    const marketState = meta.marketState ?? getMarketState(symbol.endsWith('.TW') ? 'TW' : 'US');
    return { assetId, price, change, changePercent: pct, volume: meta.regularMarketVolume, previousClose: prevClose, marketState, updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error(`Failed to fetch ${symbol}:`, err);
    return { assetId, price: 0, change: 0, changePercent: 0, updatedAt: new Date().toISOString() };
  }
}

async function fetchGoldQuote(): Promise<QuoteData> {
  const gold = await fetchBotGoldPrice();
  return { assetId: "GOLD_USD", price: (gold.buyPrice + gold.sellPrice) / 2, change: 0, changePercent: 0, buyPrice: gold.buyPrice, sellPrice: gold.sellPrice, marketState: getMarketState('GOLD'), updatedAt: gold.updatedAt };
}

async function fetchFxQuote(): Promise<QuoteData> {
  const fx = await fetchBotFxRate();
  return { assetId: "USDTWD", price: (fx.spotBuy + fx.spotSell) / 2, change: 0, changePercent: 0, buyPrice: fx.spotBuy, sellPrice: fx.spotSell, marketState: getMarketState('FX'), updatedAt: fx.updatedAt };
}

function parseYahooHistory(data: any): HistoryPoint[] {
  const result = data?.chart?.result?.[0];
  if (!result?.timestamp) return [];
  const ts: number[] = result.timestamp;
  const q = result.indicators?.quote?.[0] ?? {};
  const points: HistoryPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i] ?? 0;
    if (o == null || c == null) continue;
    points.push({ time: formatDate(ts[i]), open: o, high: h ?? o, low: l ?? o, close: c, volume: v });
  }
  return points;
}

async function fetchHistory(assetId: AssetId, range: TimeRange): Promise<HistoryPoint[]> {
  const symbol = assetId === "GOLD_USD" ? "GC=F" : assetId === "USDTWD" ? "TWD=X" : assetId;
  const cfg = TIME_RANGE_TO_YAHOO[range];
  const data = await fetchYahooChart(symbol, cfg.range, cfg.interval);
  return parseYahooHistory(data);
}

const NEWS_QUERIES: Record<AssetId, string> = {
  "0050.TW": "0050 ETF 台灣50",
  VOO: "VOO Vanguard S&P 500 ETF",
  QQQM: "QQQM Invesco NASDAQ 100 ETF",
  GOLD_USD: "黃金 gold price",
  USDTWD: "美元 台幣 匯率 USD TWD",
};

async function fetchNews(assetId: AssetId): Promise<NewsItem[]> {
  const query = NEWS_QUERIES[assetId];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FinanceDashboard/1.0)" } });
    const xml = await res.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    const arr = Array.isArray(items) ? items : [items];
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return arr.map((item: any) => {
      const title = (item.title || "").replace(/ - [^-]+$/, "").trim();
      const source = (item.source?._ || item.source || "").trim();
      const rawDesc = item.description || "";
      const cleanDesc = rawDesc.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
      return { title, summary: cleanDesc.slice(0, 200), url: item.link || "", source, publishedAt: new Date(item.pubDate || "").toISOString() };
    }).filter((n: NewsItem) => new Date(n.publishedAt).getTime() > threeDaysAgo && n.title).slice(0, 10);
  } catch (err) {
    console.error(`[News] Error fetching news for ${assetId}:`, err);
    return [];
  }
}

export const financeRouter = router({
  quotes: publicProcedure.query(async () => {
    const [q0050, qVOO, qQQQM, qGold, qFx] = await Promise.all([fetchEtfQuote("0050.TW"), fetchEtfQuote("VOO"), fetchEtfQuote("QQQM"), fetchGoldQuote(), fetchFxQuote()]);
    return [q0050, qVOO, qQQQM, qGold, qFx];
  }),
  history: publicProcedure.input(z.object({ assetId: z.enum(ASSET_IDS), range: z.enum(["1w", "1m", "3m", "6m", "1y", "3y", "10y"]) })).query(async ({ input }) => {
    const points = await fetchHistory(input.assetId, input.range as TimeRange);
    return { assetId: input.assetId, points };
  }),
  news: publicProcedure.input(z.object({ assetId: z.enum(ASSET_IDS) })).query(async ({ input }) => {
    const items = await fetchNews(input.assetId);
    return { assetId: input.assetId, items };
  }),
});
