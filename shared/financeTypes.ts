/* ── Asset identifiers ── */
export const ASSET_IDS = ["0050.TW", "VOO", "QQQM", "GOLD_USD", "USDTWD"] as const;
export type AssetId = (typeof ASSET_IDS)[number];

/* ── Asset metadata ── */
export interface AssetMeta {
  code: string;
  name: string;
  icon: string;
  currency: string;
  type: "etf" | "gold" | "fx";
}

export const ASSET_META: Record<AssetId, AssetMeta> = {
  "0050.TW": { code: "0050.TW", name: "元大台灣50 ETF", icon: "BarChart3", currency: "TWD", type: "etf" },
  VOO:       { code: "VOO",     name: "Vanguard S&P 500 ETF", icon: "TrendingUp", currency: "USD", type: "etf" },
  QQQM:      { code: "QQQM",    name: "Invesco NASDAQ 100 ETF", icon: "Activity", currency: "USD", type: "etf" },
  GOLD_USD:  { code: "黃金(美元/英兩)", name: "台銀黃金存摺", icon: "Coins", currency: "USD", type: "gold" },
  USDTWD:    { code: "USD/TWD", name: "美元兌新台幣", icon: "ArrowLeftRight", currency: "TWD", type: "fx" },
};

/* ── Quote data ── */
export interface QuoteData {
  assetId: AssetId;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  previousClose?: number;
  buyPrice?: number;
  sellPrice?: number;
  marketState?: string;
  updatedAt: string;
}

/* ── History data ── */
export type TimeRange = "1w" | "1m" | "3m" | "6m" | "1y" | "3y" | "10y";

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1w": "1 週",
  "1m": "1 月",
  "3m": "3 月",
  "6m": "6 月",
  "1y": "1 年",
  "3y": "3 年",
  "10y": "10 年",
};

export const TIME_RANGE_TO_YAHOO: Record<TimeRange, { range: string; interval: string }> = {
  "1w":  { range: "5d",  interval: "15m" },
  "1m":  { range: "1mo", interval: "1d" },
  "3m":  { range: "3mo", interval: "1d" },
  "6m":  { range: "6mo", interval: "1d" },
  "1y":  { range: "1y",  interval: "1d" },
  "3y":  { range: "3y",  interval: "1wk" },
  "10y": { range: "10y", interval: "1mo" },
};

export interface HistoryPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/* ── News data ── */
export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
}
