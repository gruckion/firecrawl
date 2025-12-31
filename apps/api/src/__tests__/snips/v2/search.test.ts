import {
  concurrentIf,
  describeIf,
  HAS_PROXY,
  HAS_SEARCH,
  TEST_PRODUCTION,
} from "../lib";
import { search, searchWithCredits, idmux, Identity } from "./lib";

let identity: Identity;

beforeAll(async () => {
  identity = await idmux({
    name: "search",
    concurrency: 100,
    credits: 1000000,
  });
}, 10000);

// NOTE: if DDG gives us issues with this, we can disable if SEARXNG is not enabled
describeIf(TEST_PRODUCTION || HAS_SEARCH || HAS_PROXY)("Search tests", () => {
  it.concurrent(
    "works",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
        },
        identity,
      );
      expect(res.web).toBeDefined();
      expect(res.web?.length).toBeGreaterThan(0);
    },
    60000,
  );

  it.concurrent(
    "works with scrape",
    async () => {
      const res = await search(
        {
          query: "firecrawl.dev",
          limit: 2,
          scrapeOptions: {
            formats: ["markdown"],
          },
          timeout: 120000,
        },
        identity,
      );

      for (const doc of res.web ?? []) {
        expect(doc.markdown).toBeDefined();
      }
    },
    125000,
  );

  concurrentIf(TEST_PRODUCTION)(
    "works for news",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          sources: ["news"],
        },
        identity,
      );
      expect(res.news).toBeDefined();
      expect(res.news?.length).toBeGreaterThan(0);
    },
    60000,
  );

  concurrentIf(TEST_PRODUCTION)(
    "works for images",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          sources: ["images"],
        },
        identity,
      );
      expect(res.images).toBeDefined();
      expect(res.images?.length).toBeGreaterThan(0);
    },
    60000,
  );

  concurrentIf(TEST_PRODUCTION)(
    "works for multiple sources",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          sources: ["web", "news", "images"],
        },
        identity,
      );
      expect(res.web).toBeDefined();
      expect(res.web?.length).toBeGreaterThan(0);
      expect(res.news).toBeDefined();
      expect(res.news?.length).toBeGreaterThan(0);
      expect(res.images).toBeDefined();
      expect(res.images?.length).toBeGreaterThan(0);
    },
    60000,
  );

  it.concurrent(
    "respects limit for web",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          limit: 3,
        },
        identity,
      );
      expect(res.web).toBeDefined();
      expect(res.web?.length).toBeGreaterThan(0);
      expect(res.web?.length).toBeLessThanOrEqual(3);
    },
    60000,
  );

  concurrentIf(TEST_PRODUCTION)(
    "respects limit for news",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          sources: ["news"],
          limit: 2,
        },
        identity,
      );
      expect(res.news).toBeDefined();
      expect(res.news?.length).toBeGreaterThan(0);
      expect(res.news?.length).toBeLessThanOrEqual(2);
    },
    60000,
  );

  it.concurrent(
    "respects limit for above 10",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          limit: 20,
        },
        identity,
      );
      expect(res.web).toBeDefined();
      expect(res.web?.length).toBeGreaterThan(0);
      expect(res.web?.length).toBeLessThanOrEqual(20);
    },
    60000,
  );

  concurrentIf(TEST_PRODUCTION)(
    "respects limit for above 10 images",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          sources: ["images"],
          limit: 20,
        },
        identity,
      );
      expect(res.images).toBeDefined();
      expect(res.images?.length).toBeGreaterThan(0);
      expect(res.images?.length).toBeLessThanOrEqual(20);
    },
    60000,
  );

  concurrentIf(TEST_PRODUCTION)(
    "respects limit for above 10 multiple sources",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          sources: ["web", "news"],
          limit: 20,
        },
        identity,
      );
      expect(res.web).toBeDefined();
      expect(res.web?.length).toBeGreaterThan(0);
      expect(res.web?.length).toBeLessThanOrEqual(20);
      expect(res.news).toBeDefined();
      expect(res.news?.length).toBeGreaterThan(0);
      expect(res.news?.length).toBeLessThanOrEqual(20);
    },
    60000,
  );

  it.concurrent(
    "country defaults to undefined when location is set",
    async () => {
      const res = await search(
        {
          query: "firecrawl",
          location: "San Francisco",
        },
        identity,
      );
      expect(res.web).toBeDefined();
      expect(res.web?.length).toBeGreaterThan(0);
    },
    60000,
  );

  it.concurrent(
    "creditsUsed includes scrape costs when scrapeOptions are provided",
    async () => {
      const res = await searchWithCredits(
        {
          query: "firecrawl.dev",
          limit: 5,
          scrapeOptions: {
            formats: ["markdown"],
            proxy: "basic",
            parsers: [],
          },
          timeout: 120000,
        },
        identity,
      );

      // creditsUsed should include both search credits (2 per 10 results) and scrape credits
      // With 5 results: search credits = ceil(5/10) * 2 = 2, plus scrape credits (1 per page with basic proxy and no parsers)
      // So total should be exactly 2 (search) + 5 (scrapes) = 7
      expect(res.creditsUsed).toBeDefined();
      expect(res.creditsUsed).toBe(7);

      // Verify we got scraped content
      for (const doc of res.data.web ?? []) {
        expect(doc.markdown).toBeDefined();
      }
    },
    125000,
  );

  it.concurrent(
    "creditsUsed only includes search costs when no scrapeOptions",
    async () => {
      const res = await searchWithCredits(
        {
          query: "firecrawl",
          limit: 5,
        },
        identity,
      );

      // Without scraping, creditsUsed should only be search credits (2 per 10 results)
      // With up to 5 results: ceil(5/10) * 2 = 2
      expect(res.creditsUsed).toBeDefined();
      expect(res.creditsUsed).toBe(2);
    },
    60000,
  );

  it.concurrent(
    "creditsUsed is correct for ZDR search with scraping",
    async () => {
      // Create a ZDR-enabled identity for this test
      const zdrIdentity = await idmux({
        name: "search/zdr-credits",
        concurrency: 100,
        credits: 1000000,
        flags: {
          allowZDR: true,
        },
      });

      const res = await searchWithCredits(
        {
          query: "firecrawl.dev",
          limit: 5,
          enterprise: ["zdr"],
          scrapeOptions: {
            formats: ["markdown"],
            proxy: "basic",
            parsers: [],
          },
          timeout: 120000,
        },
        zdrIdentity,
      );

      // ZDR search credits = ceil(5/10) * 10 = 10 (10 credits per 10 results for ZDR)
      // ZDR scrape credits = 5 * 2 = 10 (2 credits per page for ZDR)
      // Total = 10 + 10 = 20
      expect(res.creditsUsed).toBeDefined();
      expect(res.creditsUsed).toBe(20);

      // Verify we got scraped content
      for (const doc of res.data.web ?? []) {
        expect(doc.markdown).toBeDefined();
      }
    },
    125000,
  );
});
