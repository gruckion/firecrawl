import { drizzle as _drizzle, NodePgClient } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { config } from "../config";
import { logger } from "../lib/logger";
import { configDotenv } from "dotenv";
import { TablesRelationalConfig } from "drizzle-orm/relations";
configDotenv();

// SupabaseService class initializes the Supabase client conditionally based on environment variables.
class DrizzleService {
  private client: ReturnType<
    typeof _drizzle<typeof schema, TablesRelationalConfig, NodePgClient>
  > | null = null;
  constructor() {
    const databaseUri = config.DATABASE_URI;
    if (!databaseUri) {
      logger.error(
        "DATABASE_URI environment variable is not configured correctly. Drizzle client will not be initialized. Fix ENV configuration or disable DB authentication with USE_DB_AUTHENTICATION env variable",
      );
      this.client = null;
    } else {
      this.client = _drizzle(databaseUri, { schema });
    }
  }

  // Provides access to the initialized Drizzle client, if available.
  getClient(): ReturnType<
    typeof _drizzle<typeof schema, TablesRelationalConfig, NodePgClient>
  > | null {
    return this.client;
  }
}

const serv = new DrizzleService();

// Using a Proxy to handle dynamic access to the Supabase client or service methods.
// This approach ensures that if Supabase is not configured, any attempt to use it will result in a clear error.
export const drizzle: ReturnType<
  typeof _drizzle<typeof schema, TablesRelationalConfig, NodePgClient>
> = new Proxy(serv, {
  get: function (target, prop, receiver) {
    const client = target.getClient();
    // If the Supabase client is not initialized, intercept property access to provide meaningful error feedback.
    if (client === null) {
      return () => {
        throw new Error("Drizzle client is not configured.");
      };
    }
    // Direct access to SupabaseService properties takes precedence.
    if (prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    // Otherwise, delegate access to the Supabase client.
    return Reflect.get(client, prop, receiver);
  },
}) as unknown as ReturnType<
  typeof _drizzle<typeof schema, TablesRelationalConfig, NodePgClient>
>;
