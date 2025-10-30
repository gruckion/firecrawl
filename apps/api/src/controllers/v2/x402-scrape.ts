import { Response } from "express";
import {
  Document,
  RequestWithAuth,
  ScrapeRequest,
  ScrapeResponse,
  scrapeRequestSchema,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import { addScrapeJob, waitForJob } from "../../services/queue-jobs";
import { logJob } from "../../services/logging/log_job";
import * as Sentry from "@sentry/node";
import { logger as _logger } from "../../lib/logger";
import { getJobPriority } from "../../lib/job-priority";
import { scrapeQueue } from "../../services/worker/nuq";
import { z } from "zod";
import { TransportableError } from "../../lib/error";
import { hasFormatOfType } from "../../lib/format-utils";

export async function x402ScrapeController(
  req: RequestWithAuth<{}, ScrapeResponse, ScrapeRequest>,
  res: Response<ScrapeResponse>,
) {
  const jobId = uuidv4();
  let logger = _logger.child({
    jobId,
    teamId: req.auth.team_id,
    module: "api/v2",
    method: "x402ScrapeController",
    zeroDataRetention: req.acuc?.flags?.forceZDR,
  });

  const startTime = new Date().getTime();
  const isScrapePreview =
    process.env.SEARCH_PREVIEW_TOKEN !== undefined &&
    process.env.SEARCH_PREVIEW_TOKEN === req.body.__searchPreviewToken;

  let credits_billed = 0;

  try {
    req.body = scrapeRequestSchema.parse(req.body);

    logger = logger.child({
      url: req.body.url,
      origin: req.body.origin,
    });

    logger.info("Starting X402 scrape [x402]");

    const zeroDataRetention =
      req.acuc?.flags?.forceZDR || req.body.zeroDataRetention;

    const origin = req.body.origin;
    const timeout = req.body.timeout;

    // Use direct to BullMQ for preview mode
    const directToBullMQ = isScrapePreview;

    const jobPriority = await getJobPriority({
      team_id: req.auth.team_id,
      basePriority: 10,
    });

    logger.info("Adding scrape job [x402]", {
      scrapeId: jobId,
      url: req.body.url,
      teamId: req.auth.team_id,
      origin: origin,
      zeroDataRetention,
    });

    await addScrapeJob(
      {
        url: req.body.url,
        mode: "single_urls",
        team_id: req.auth.team_id,
        scrapeOptions: {
          ...req.body,
          // Set maxAge for caching
          maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
        },
        internalOptions: {
          teamId: req.auth.team_id,
          bypassBilling: true, // X402 handles billing separately
          zeroDataRetention,
        },
        origin: origin,
        // Do not touch this flag
        is_scrape: true,
        startTime: Date.now(),
        zeroDataRetention,
        apiKeyId: req.acuc?.api_key_id ?? null,
      },
      jobId,
      jobPriority,
      directToBullMQ,
      true,
    );

    const totalWait =
      (req.body.waitFor ?? 0) +
      (req.body.actions ?? []).reduce(
        (a, x) => (x.type === "wait" ? (x.milliseconds ?? 0) : 0) + a,
        0,
      );

    let doc: Document;
    try {
      doc = await waitForJob(
        jobId,
        timeout !== undefined ? timeout + totalWait : null,
        zeroDataRetention,
        logger,
      );

      logger.info("Scrape job completed [x402]", {
        scrapeId: jobId,
        url: req.body.url,
        teamId: req.auth.team_id,
        origin: origin,
      });

      await scrapeQueue.removeJob(jobId, logger);

      if (!hasFormatOfType(req.body.formats, "rawHtml")) {
        if (doc && doc.rawHtml) {
          delete doc.rawHtml;
        }
      }

      // Bill for 1 successful scrape
      credits_billed = 1;
    } catch (error) {
      logger.error(`Error in x402 scrape: ${error}`, {
        url: req.body.url,
        teamId: req.auth.team_id,
      });

      if (zeroDataRetention) {
        await scrapeQueue.removeJob(jobId, logger);
      }

      if (error instanceof TransportableError) {
        const statusCode = error.code === "SCRAPE_TIMEOUT" ? 408 : 500;
        
        const endTime = new Date().getTime();
        const timeTakenInSeconds = (endTime - startTime) / 1000;

        logJob(
          {
            job_id: jobId,
            success: false,
            num_docs: 0,
            docs: [],
            time_taken: timeTakenInSeconds,
            team_id: req.auth.team_id,
            mode: "scrape",
            url: req.body.url,
            scrapeOptions: req.body,
            origin: origin,
            integration: req.body.integration,
            credits_billed: 0,
            zeroDataRetention,
          },
          false,
          isScrapePreview,
        );

        return res.status(statusCode).json({
          success: false,
          code: error.code,
          error: error.message,
        });
      } else {
        const endTime = new Date().getTime();
        const timeTakenInSeconds = (endTime - startTime) / 1000;

        logJob(
          {
            job_id: jobId,
            success: false,
            num_docs: 0,
            docs: [],
            time_taken: timeTakenInSeconds,
            team_id: req.auth.team_id,
            mode: "scrape",
            url: req.body.url,
            scrapeOptions: req.body,
            origin: origin,
            integration: req.body.integration,
            credits_billed: 0,
            zeroDataRetention,
          },
          false,
          isScrapePreview,
        );

        return res.status(500).json({
          success: false,
          error: `(Internal server error) - ${error && error.message ? error.message : error}`,
        });
      }
    }

    const endTime = new Date().getTime();
    const timeTakenInSeconds = (endTime - startTime) / 1000;

    logger.info("Logging job [x402]", {
      num_docs: credits_billed,
      time_taken: timeTakenInSeconds,
    });

    logJob(
      {
        job_id: jobId,
        success: true,
        num_docs: credits_billed,
        docs: [doc],
        time_taken: timeTakenInSeconds,
        team_id: req.auth.team_id,
        mode: "scrape",
        url: req.body.url,
        scrapeOptions: req.body,
        origin: origin,
        integration: req.body.integration,
        credits_billed,
        zeroDataRetention,
      },
      false,
      isScrapePreview,
    );

    return res.status(200).json({
      success: true,
      data: doc,
      scrape_id: origin?.includes("website") ? jobId : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Invalid request body [x402]", { error: error.errors });
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: error.errors,
      });
    }

    Sentry.captureException(error);
    logger.error("Unhandled error occurred in scrape [x402]", { error });
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

