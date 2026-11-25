import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// In Node.js environments without global WebSocket, Neon pool uses ws or fetch.
// Node 22+ / 24+ provides global WebSocket natively.
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

const connectionString = process.env.DATABASE_URL;

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

export function getPool(): Pool {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Please configure your Neon PostgreSQL connection string in .env.local"
    );
  }
  if (!globalForDb.pool) {
    globalForDb.pool = new Pool({ connectionString });
  }
  return globalForDb.pool;
}

export const db = drizzle({
  client: new Pool({
    connectionString: connectionString || "postgresql://localhost:5432/placeholder",
  }),
  schema,
});

export * from "./schema";
