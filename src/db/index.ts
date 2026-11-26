import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket;
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  drizzleDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
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

export function getDb() {
  if (!globalForDb.drizzleDb) {
    globalForDb.drizzleDb = drizzle({
      client: getPool(),
      schema,
    });
  }
  return globalForDb.drizzleDb;
}

// Lazy proxy so importing `db` never freezes an empty DATABASE_URL before dotenv loads
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export * from "./schema";
