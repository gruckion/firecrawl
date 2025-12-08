import { config } from "../../config";
import "dotenv/config";
import { logger as _logger } from "../../lib/logger";
import { configDotenv } from "dotenv";
import {
  saveDeepResearchToGCS,
  saveExtractToGCS,
  saveLlmsTxtToGCS,
  saveMapToGCS,
  saveScrapeToGCS,
  saveSearchToGCS,
} from "../../lib/gcs-jobs";
import { hasFormatOfType } from "../../lib/format-utils";
import type { Document, ScrapeOptions } from "../../controllers/v2/types";
import type { CostTracking } from "../../lib/cost-tracking";
import { sql } from "drizzle-orm";
import { drizzle } from "../drizzle";
import {
  batchScrapes,
  crawls,
  deepResearches,
  extracts,
  llmstxts,
  maps,
  requests,
  scrapes,
  searches,
} from "../../db/schema";
configDotenv();

const previewTeamId = "3adefd26-77ec-5968-8dcf-c94b5630d1de";

type LoggedRequest = {
  id: string;
  kind:
    | "scrape"
    | "crawl"
    | "batch_scrape"
    | "search"
    | "extract"
    | "llmstxt"
    | "deep_research"
    | "map";
  api_version: string;
  team_id: string;
  origin: string;
  integration?: string | null;
  target_hint: string;
  zeroDataRetention: boolean;
  api_key_id?: number | null;
};

export async function logRequest(request: LoggedRequest) {
  const logger = _logger.child({
    module: "log_job",
    method: "logRequest",
    requestId: request.id,
    teamId: request.team_id,
    zeroDataRetention: request.zeroDataRetention,
  });

  await drizzle.insert(requests).values({
    id: request.id,
    kind: request.kind,
    apiVersion: request.api_version,
    teamId:
      request.team_id === "preview" || request.team_id?.startsWith("preview_")
        ? previewTeamId
        : request.team_id,
    origin: request.origin,
    integration: request.integration ?? null,
    targetHint: request.zeroDataRetention
      ? "<redacted due to zero data retention>"
      : request.target_hint,
    drCleanBy: request.zeroDataRetention
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null,
    apiKeyId: request.api_key_id ?? null,
  });

  logger.info("Request logged successfully", { requestId: request.id });
}

export type LoggedScrape = {
  id: string;
  request_id: string;
  url: string;
  is_successful: boolean;
  error?: string;
  doc?: Document;
  time_taken: number;
  team_id: string;
  options: ScrapeOptions;
  cost_tracking?: ReturnType<typeof CostTracking.prototype.toJSON>;
  pdf_num_pages?: number;
  credits_cost: number;
  skipNuq: boolean;
  zeroDataRetention: boolean;
};

export async function logScrape(scrape: LoggedScrape) {
  const logger = _logger.child({
    module: "log_job",
    method: "logScrape",
    scrapeId: scrape.id,
    requestId: scrape.request_id,
    teamId: scrape.team_id,
    zeroDataRetention: scrape.zeroDataRetention,
  });

  await drizzle.insert(scrapes).values({
    id: scrape.id,
    requestId: scrape.request_id,
    url: scrape.zeroDataRetention
      ? "<redacted due to zero data retention>"
      : scrape.url,
    isSuccessful: scrape.is_successful,
    error: scrape.error ?? null,
    timeTaken: scrape.time_taken,
    teamId:
      scrape.team_id === "preview" || scrape.team_id?.startsWith("preview_")
        ? previewTeamId
        : scrape.team_id,
    options: scrape.zeroDataRetention ? null : scrape.options,
    costTracking: scrape.zeroDataRetention
      ? null
      : (scrape.cost_tracking ?? null),
    pdfNumPages: scrape.zeroDataRetention
      ? null
      : (scrape.pdf_num_pages ?? null),
    creditsCost: scrape.credits_cost,
  });

  logger.info("Scrape logged successfully", { scrapeId: scrape.id });

  if (
    scrape.doc &&
    config.GCS_BUCKET_NAME &&
    !(scrape.skipNuq && scrape.zeroDataRetention)
  ) {
    await saveScrapeToGCS(scrape);
  }

  if (
    scrape.is_successful &&
    !scrape.zeroDataRetention &&
    config.USE_DB_AUTHENTICATION
  ) {
    const hasMarkdown = hasFormatOfType(scrape.options.formats, "markdown");
    const hasChangeTracking = hasFormatOfType(
      scrape.options.formats,
      "changeTracking",
    );

    if (hasMarkdown || hasChangeTracking) {
      try {
        await drizzle.execute(
          sql`SELECT change_tracking_insert_scrape(
            ${scrape.team_id},
            ${scrape.url},
            ${scrape.id},
            ${hasChangeTracking ? hasChangeTracking.tag : null},
            ${new Date().toISOString()}
          )`,
        );
        _logger.debug("Change tracking record inserted successfully");
      } catch (error) {
        _logger.warn("Error inserting into change_tracking_scrapes", {
          error,
          scrapeId: scrape.id,
          teamId: scrape.team_id,
        });
      }
    }
  }
}

type LoggedCrawl = {
  id: string;
  request_id: string;
  url: string;
  team_id: string;
  options: any;
  num_docs: number;
  credits_cost: number;
  zeroDataRetention: boolean;
  cancelled: boolean;
};

export async function logCrawl(crawl: LoggedCrawl) {
  const logger = _logger.child({
    module: "log_job",
    method: "logCrawl",
    crawlId: crawl.id,
    requestId: crawl.request_id,
    teamId: crawl.team_id,
    zeroDataRetention: crawl.zeroDataRetention,
  });

  await drizzle.insert(crawls).values({
    id: crawl.id,
    requestId: crawl.request_id,
    url: crawl.zeroDataRetention
      ? "<redacted due to zero data retention>"
      : crawl.url,
    teamId:
      crawl.team_id === "preview" || crawl.team_id?.startsWith("preview_")
        ? previewTeamId
        : crawl.team_id,
    options: crawl.zeroDataRetention ? null : crawl.options,
    numDocs: crawl.num_docs,
    creditsCost: crawl.credits_cost,
    cancelled: crawl.cancelled,
  });

  logger.info("Crawl logged successfully", { crawlId: crawl.id });
}

type LoggedBatchScrape = {
  id: string;
  request_id: string;
  team_id: string;
  num_docs: number;
  credits_cost: number;
  zeroDataRetention: boolean;
  cancelled: boolean;
};

export async function logBatchScrape(batchScrape: LoggedBatchScrape) {
  const logger = _logger.child({
    module: "log_job",
    method: "logBatchScrape",
    batchScrapeId: batchScrape.id,
    requestId: batchScrape.request_id,
    teamId: batchScrape.team_id,
    zeroDataRetention: batchScrape.zeroDataRetention,
  });

  await drizzle.insert(batchScrapes).values({
    id: batchScrape.id,
    requestId: batchScrape.request_id,
    teamId:
      batchScrape.team_id === "preview" ||
      batchScrape.team_id?.startsWith("preview_")
        ? previewTeamId
        : batchScrape.team_id,
    numDocs: batchScrape.num_docs,
    creditsCost: batchScrape.credits_cost,
    cancelled: batchScrape.cancelled,
  });

  logger.info("Batch scrape logged successfully", {
    batchScrapeId: batchScrape.id,
  });
}

export type LoggedSearch = {
  id: string;
  request_id: string;
  query: string;
  team_id: string;
  options: any;
  time_taken: number;
  credits_cost: number;
  is_successful: boolean;
  error?: string;
  num_results: number;
  results: any;
  zeroDataRetention: boolean;
};

export async function logSearch(search: LoggedSearch) {
  const logger = _logger.child({
    module: "log_job",
    method: "logSearch",
    searchId: search.id,
    requestId: search.request_id,
    teamId: search.team_id,
    zeroDataRetention: search.zeroDataRetention,
  });

  await drizzle.insert(searches).values({
    id: search.id,
    requestId: search.request_id,
    query: search.zeroDataRetention
      ? "<redacted due to zero data retention>"
      : search.query,
    teamId:
      search.team_id === "preview" || search.team_id?.startsWith("preview_")
        ? previewTeamId
        : search.team_id,
    options: search.zeroDataRetention ? null : search.options,
    creditsCost: search.credits_cost,
    isSuccessful: search.is_successful,
    error: search.zeroDataRetention ? null : (search.error ?? null),
    numResults: search.num_results,
    timeTaken: search.time_taken,
  });

  logger.info("Search logged successfully", { searchId: search.id });

  if (search.results && !search.zeroDataRetention) {
    await saveSearchToGCS(search);
  }
}

export type LoggedExtract = {
  id: string;
  request_id: string;
  urls: string[];
  team_id: string;
  options: any;
  model_kind: "fire-0" | "fire-1";
  credits_cost: number;
  is_successful: boolean;
  error?: string;
  result?: any;
  cost_tracking?: ReturnType<typeof CostTracking.prototype.toJSON>;
};

export async function logExtract(extract: LoggedExtract) {
  const logger = _logger.child({
    module: "log_job",
    method: "logExtract",
    extractId: extract.id,
    requestId: extract.request_id,
    teamId: extract.team_id,
  });

  await drizzle.insert(extracts).values({
    id: extract.id,
    requestId: extract.request_id,
    urls: extract.urls,
    teamId:
      extract.team_id === "preview" || extract.team_id?.startsWith("preview_")
        ? previewTeamId
        : extract.team_id,
    options: extract.options,
    modelKind: extract.model_kind,
    creditsCost: extract.credits_cost,
    isSuccessful: extract.is_successful,
    error: extract.error ?? null,
    costTracking: extract.cost_tracking ?? null,
  });

  logger.info("Extract logged successfully", { extractId: extract.id });

  if (extract.result) {
    await saveExtractToGCS(extract);
  }
}

export type LoggedMap = {
  id: string;
  request_id: string;
  url: string;
  team_id: string;
  options: any;
  results: any[];
  credits_cost: number;
  zeroDataRetention: boolean;
};

export async function logMap(map: LoggedMap) {
  const logger = _logger.child({
    module: "log_job",
    method: "logMap",
    mapId: map.id,
    requestId: map.request_id,
    teamId: map.team_id,
    zeroDataRetention: map.zeroDataRetention,
  });

  await drizzle.insert(maps).values({
    id: map.id,
    requestId: map.request_id,
    url: map.zeroDataRetention
      ? "<redacted due to zero data retention>"
      : map.url,
    teamId:
      map.team_id === "preview" || map.team_id?.startsWith("preview_")
        ? previewTeamId
        : map.team_id,
    options: map.zeroDataRetention ? null : map.options,
    numResults: map.results.length,
    creditsCost: map.credits_cost,
  });

  logger.info("Map logged successfully", { mapId: map.id });

  if (map.results && !map.zeroDataRetention) {
    await saveMapToGCS(map);
  }
}

export type LoggedLlmsTxt = {
  id: string;
  request_id: string;
  url: string;
  team_id: string;
  options: any;
  num_urls: number;
  cost_tracking?: ReturnType<typeof CostTracking.prototype.toJSON>;
  credits_cost: number;
  result: { llmstxt: string; llmsfulltxt: string };
};

export async function logLlmsTxt(llmsTxt: LoggedLlmsTxt) {
  const logger = _logger.child({
    module: "log_job",
    method: "logLlmsTxt",
    llmsTxtId: llmsTxt.id,
    requestId: llmsTxt.request_id,
    teamId: llmsTxt.team_id,
  });

  await drizzle.insert(llmstxts).values({
    id: llmsTxt.id,
    requestId: llmsTxt.request_id,
    url: llmsTxt.url,
    teamId:
      llmsTxt.team_id === "preview" || llmsTxt.team_id?.startsWith("preview_")
        ? previewTeamId
        : llmsTxt.team_id,
    options: llmsTxt.options,
    numUrls: llmsTxt.num_urls,
    creditsCost: llmsTxt.credits_cost,
    costTracking: llmsTxt.cost_tracking ?? null,
  });

  logger.info("LlmsTxt logged successfully", { llmsTxtId: llmsTxt.id });

  if (llmsTxt.result) {
    await saveLlmsTxtToGCS(llmsTxt);
  }
}

export type LoggedDeepResearch = {
  id: string;
  request_id: string;
  query: string;
  team_id: string;
  options: any;
  time_taken: number;
  credits_cost: number;
  result: { finalAnalysis: string; sources: any; json: any };
  cost_tracking?: ReturnType<typeof CostTracking.prototype.toJSON>;
};

export async function logDeepResearch(deepResearch: LoggedDeepResearch) {
  const logger = _logger.child({
    module: "log_job",
    method: "logDeepResearch",
    deepResearchId: deepResearch.id,
    requestId: deepResearch.request_id,
    teamId: deepResearch.team_id,
  });

  await drizzle.insert(deepResearches).values({
    id: deepResearch.id,
    requestId: deepResearch.request_id,
    query: deepResearch.query,
    teamId:
      deepResearch.team_id === "preview" ||
      deepResearch.team_id?.startsWith("preview_")
        ? previewTeamId
        : deepResearch.team_id,
    options: deepResearch.options,
    timeTaken: deepResearch.time_taken,
    creditsCost: deepResearch.credits_cost,
    costTracking: deepResearch.cost_tracking ?? null,
  });

  logger.info("Deep research logged successfully", {
    deepResearchId: deepResearch.id,
  });

  if (deepResearch.result) {
    await saveDeepResearchToGCS(deepResearch);
  }
}
