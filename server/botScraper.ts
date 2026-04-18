/**
 * 台灣銀行牌價爬蟲
 * - 黃金存摺（美元計價）買進/賣出價 - 從 chart JSON data 提取
 * - USD/TWD 匯率（現金/即期）- 從 CSV 或 HTML 提取
 */

interface GoldPrice { buyPrice: number; sellPrice: number; updatedAt: string; }
interface FxRate { cashBuy: number; cashSell: number; spotBuy: number; spotSell: number; updatedAt: string; }

let goldCache: GoldPrice | null = null;
let fxCache: FxRate | null = null;
let goldCacheTime = 0;
let fxCacheTime = 0;
const CACHE_TTL = 120_000;

export async function fetchBotGoldPrice(): Promise<GoldPrice> {
  if (goldCache && Date.now() - goldCacheTime < CACHE_TTL) return goldCache;
  try {
    // Fetch from chart page which contains JSON series data
    const res = await fetch("https://rate.bot.com.tw/gold/chart/ltm/USD?Lang=zh-TW", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html" },
    });
    const html = await res.text();

    // Extract series data - first series is 本行賣出, second is 本行買入
    const dataMatches = html.match(/"data":\[\[[\d,.\[\]]+\]\]/g);
    if (dataMatches && dataMatches.length >= 2) {
      // Parse sell price (first series)
      const sellDataStr = dataMatches[0].replace('"data":', '');
      const sellArr: number[][] = JSON.parse(sellDataStr);
      const latestSell = sellArr[sellArr.length - 1]?.[1] ?? 0;

      // Parse buy price (second series)
      const buyDataStr = dataMatches[1].replace('"data":', '');
      const buyArr: number[][] = JSON.parse(buyDataStr);
      const latestBuy = buyArr[buyArr.length - 1]?.[1] ?? 0;

      if (latestBuy > 0 && latestSell > 0) {
        goldCache = { buyPrice: latestBuy, sellPrice: latestSell, updatedAt: new Date().toISOString() };
        goldCacheTime = Date.now();
        return goldCache;
      }
    }

    if (goldCache) return goldCache;
    return { buyPrice: 0, sellPrice: 0, updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[BotScraper] Gold fetch error:", err);
    if (goldCache) return goldCache;
    return { buyPrice: 0, sellPrice: 0, updatedAt: new Date().toISOString() };
  }
}

export async function fetchBotFxRate(): Promise<FxRate> {
  if (fxCache && Date.now() - fxCacheTime < CACHE_TTL) return fxCache;
  try {
    const res = await fetch("https://rate.bot.com.tw/xrt/flcsv/0/day", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const csv = await res.text();
    const lines = csv.split("\n");
    for (const line of lines) {
      if (line.includes("USD") || line.includes("美金")) {
        const cols = line.split(",");
        const nums = cols.map(c => c.trim().replace(/"/g, "")).filter(c => /^\d+(\.\d+)?$/.test(c)).map(Number);
        if (nums.length >= 4) {
          fxCache = { cashBuy: nums[0], cashSell: nums[1], spotBuy: nums[2], spotSell: nums[3], updatedAt: new Date().toISOString() };
          fxCacheTime = Date.now();
          return fxCache;
        }
      }
    }
    // Fallback HTML
    const htmlRes = await fetch("https://rate.bot.com.tw/xrt?Lang=zh-TW", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html" },
    });
    const html = await htmlRes.text();
    const usdIdx = html.indexOf("美金 (USD)");
    if (usdIdx > -1) {
      const snippet = html.substring(usdIdx, usdIdx + 2000);
      const rateMatches = snippet.match(/[\d]+\.[\d]+/g);
      if (rateMatches && rateMatches.length >= 4) {
        fxCache = { cashBuy: parseFloat(rateMatches[0]), cashSell: parseFloat(rateMatches[1]), spotBuy: parseFloat(rateMatches[2]), spotSell: parseFloat(rateMatches[3]), updatedAt: new Date().toISOString() };
        fxCacheTime = Date.now();
        return fxCache;
      }
    }
    if (fxCache) return fxCache;
    return { cashBuy: 0, cashSell: 0, spotBuy: 0, spotSell: 0, updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[BotScraper] FX fetch error:", err);
    if (fxCache) return fxCache;
    return { cashBuy: 0, cashSell: 0, spotBuy: 0, spotSell: 0, updatedAt: new Date().toISOString() };
  }
}
