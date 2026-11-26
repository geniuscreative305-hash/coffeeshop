import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { Pool } from "@neondatabase/serverless";
import { list } from "@vercel/blob";

async function main() {
  console.log("=== CONNECTION DIAGNOSTIC ===");
  console.log("DATABASE_URL set:", Boolean(process.env.DATABASE_URL));
  console.log("BLOB_READ_WRITE_TOKEN set:", Boolean(process.env.BLOB_READ_WRITE_TOKEN));
  console.log("JWT_SECRET set:", Boolean(process.env.JWT_SECRET));

  if (!process.env.DATABASE_URL) {
    console.log("-> DATABASE_URL is missing in .env.local!");
  } else {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const res = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );
      const tables = res.rows.map((r) => r.table_name);
      console.log("Neon tables found (" + tables.length + "):", tables.join(", ") || "(none)");

      for (const t of ["categories", "products", "promos", "vouchers", "store_settings", "admin_users"]) {
        if (tables.includes(t)) {
          const c = await pool.query(`SELECT count(*)::int AS cnt FROM ${t}`);
          console.log(`  - ${t}: ${c.rows[0].cnt} rows`);
        }
      }
    } catch (err) {
      console.error("Neon connection error:", err.message);
    } finally {
      await pool.end();
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log("-> BLOB_READ_WRITE_TOKEN is missing in .env.local!");
  } else {
    try {
      const blobs = await list({ limit: 1, token: process.env.BLOB_READ_WRITE_TOKEN });
      console.log("Vercel Blob connected OK! Sample blobs:", blobs.blobs.length);
    } catch (err) {
      console.error("Vercel Blob error:", err.message);
    }
  }
}

main();

