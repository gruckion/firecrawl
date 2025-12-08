import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  bigint,
  boolean,
  numeric,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const requestKind = pgEnum("request_kind", [
  "scrape",
  "crawl",
  "batch_scrape",
  "search",
  "extract",
  "llmstxt",
  "deep_research",
  "map",
]);
export const extractModelKind = pgEnum("extract_model_kind", [
  "fire-0",
  "fire-1",
]);

export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().notNull(), // no default -- this should be uuidv7, but our pg version is too old
  kind: requestKind("kind").notNull(),
  apiVersion: text("api_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  teamId: uuid("team_id").notNull(),
  origin: text("origin").notNull(),
  integration: text("integration"),
  targetHint: text("target_hint").notNull(),
  drCleanBy: timestamp("dr_clean_by", { withTimezone: true }),
  apiKeyId: bigint("api_key_id", { mode: "number" }),
});

export const scrapes = pgTable("scrapes", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  url: text("url").notNull(),
  isSuccessful: boolean("is_successful").notNull(),
  error: text("error"),
  timeTaken: numeric("time_taken", { mode: "number" }).notNull(),
  teamId: uuid("team_id").notNull(),
  options: jsonb("options"),
  costTracking: jsonb("cost_tracking"),
  pdfNumPages: integer("pdf_num_pages"),
  creditsCost: integer("credits_cost").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const crawls = pgTable("crawls", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  url: text("url").notNull(),
  teamId: uuid("team_id").notNull(),
  options: jsonb("options"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  numDocs: integer("num_docs").notNull(),
  creditsCost: integer("credits_cost").notNull(),
  cancelled: boolean("cancelled").notNull(),
});

export const batchScrapes = pgTable("batch_scrapes", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  teamId: uuid("team_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  numDocs: integer("num_docs").notNull(),
  creditsCost: integer("credits_cost").notNull(),
  cancelled: boolean("cancelled").notNull(),
});

export const searches = pgTable("searches", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  query: text("query").notNull(),
  teamId: uuid("team_id").notNull(),
  options: jsonb("options"),
  timeTaken: numeric("time_taken", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  creditsCost: integer("credits_cost").notNull(),
  isSuccessful: boolean("is_successful").notNull(),
  error: text("error"),
  numResults: integer("num_results").notNull(),
});

export const extracts = pgTable("extracts", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  urls: text("urls").array().notNull(),
  options: jsonb("options"),
  modelKind: extractModelKind("model_kind").notNull(),
  teamId: uuid("team_id").notNull(),
  isSuccessful: boolean("is_successful").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  creditsCost: integer("credits_cost").notNull(),
  costTracking: jsonb("cost_tracking"),
});

export const maps = pgTable("maps", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  url: text("url").notNull(),
  options: jsonb("options"),
  teamId: uuid("team_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  numResults: integer("num_results").notNull(),
  creditsCost: integer("credits_cost").notNull(),
});

export const llmstxts = pgTable("llmstxts", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  url: text("url").notNull(),
  teamId: uuid("team_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  numUrls: integer("num_urls").notNull(),
  options: jsonb("options"),
  costTracking: jsonb("cost_tracking"),
  creditsCost: integer("credits_cost").notNull(),
});

export const deepResearches = pgTable("deep_researches", {
  id: uuid("id").primaryKey().notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => requests.id),
  query: text("query").notNull(),
  teamId: uuid("team_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  timeTaken: numeric("time_taken", { mode: "number" }).notNull(),
  creditsCost: integer("credits_cost").notNull(),
  costTracking: jsonb("cost_tracking"),
  options: jsonb("options"),
});
