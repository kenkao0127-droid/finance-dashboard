import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("finance.quotes", () => {
  it("returns an array of 5 quotes with correct structure", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const quotes = await caller.finance.quotes();

    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBe(5);

    const ids = quotes.map(q => q.assetId);
    expect(ids).toContain("0050.TW");
    expect(ids).toContain("VOO");
    expect(ids).toContain("QQQM");
    expect(ids).toContain("GOLD_USD");
    expect(ids).toContain("USDTWD");

    for (const q of quotes) {
      expect(q).toHaveProperty("assetId");
      expect(q).toHaveProperty("price");
      expect(q).toHaveProperty("change");
      expect(q).toHaveProperty("changePercent");
      expect(q).toHaveProperty("updatedAt");
      expect(typeof q.price).toBe("number");
    }

    const etfQuotes = quotes.filter(q => ["0050.TW", "VOO", "QQQM"].includes(q.assetId));
    for (const q of etfQuotes) {
      expect(q.price).toBeGreaterThan(0);
      expect(q.marketState).toBeDefined();
    }

    const gold = quotes.find(q => q.assetId === "GOLD_USD");
    expect(gold?.buyPrice).toBeDefined();
    expect(gold?.sellPrice).toBeDefined();

    const fx = quotes.find(q => q.assetId === "USDTWD");
    expect(fx?.buyPrice).toBeDefined();
    expect(fx?.sellPrice).toBeDefined();
  }, 30000);
});

describe("finance.history", () => {
  it("returns history points for 0050.TW 3m", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.finance.history({ assetId: "0050.TW", range: "3m" });

    expect(result.assetId).toBe("0050.TW");
    expect(Array.isArray(result.points)).toBe(true);
    expect(result.points.length).toBeGreaterThan(0);

    const pt = result.points[0];
    expect(pt).toHaveProperty("time");
    expect(pt).toHaveProperty("open");
    expect(pt).toHaveProperty("high");
    expect(pt).toHaveProperty("low");
    expect(pt).toHaveProperty("close");
    expect(pt).toHaveProperty("volume");
    expect(typeof pt.close).toBe("number");
    expect(pt.close).toBeGreaterThan(0);
  }, 30000);

  it("returns history points for GOLD_USD", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.finance.history({ assetId: "GOLD_USD", range: "1m" });

    expect(result.assetId).toBe("GOLD_USD");
    expect(Array.isArray(result.points)).toBe(true);
    expect(result.points.length).toBeGreaterThan(0);
  }, 30000);
});

describe("finance.news", () => {
  it("returns news items for 0050.TW within 3 days", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.finance.news({ assetId: "0050.TW" });

    expect(result.assetId).toBe("0050.TW");
    expect(Array.isArray(result.items)).toBe(true);

    if (result.items.length > 0) {
      const item = result.items[0];
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("url");
      expect(item).toHaveProperty("source");
      expect(item).toHaveProperty("publishedAt");
      expect(item.title.length).toBeGreaterThan(0);

      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      for (const n of result.items) {
        expect(new Date(n.publishedAt).getTime()).toBeGreaterThan(threeDaysAgo);
      }
    }
  }, 30000);
});
