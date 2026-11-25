import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { Pool } from "@neondatabase/serverless";

/**
 * Idempotent, non-destructive schema migration script.
 * Never executes DROP TABLE or deletes existing transactional data.
 */
async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing in .env / .env.local");
  }

  const pool = new Pool({ connectionString: url });

  try {
    console.log("Running safe idempotent migration...");

    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE order_type AS ENUM ('Dine-In', 'Pickup', 'Delivery');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('Cash', 'QRIS', 'Transfer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('Pending', 'Brewing', 'Ready', 'Completed', 'Cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(140) NOT NULL UNIQUE,
        icon_name VARCHAR(64) NOT NULL DEFAULT 'Coffee',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        name VARCHAR(180) NOT NULL,
        slug VARCHAR(200) NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL,
        discount_price INTEGER,
        image_url TEXT NOT NULL,
        badge_label VARCHAR(64),
        is_limited_stock BOOLEAN NOT NULL DEFAULT false,
        daily_quota INTEGER NOT NULL DEFAULT 0,
        remaining_stock INTEGER NOT NULL DEFAULT 0,
        is_available BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        group_name VARCHAR(100) NOT NULL,
        option_name VARCHAR(120) NOT NULL,
        additional_price INTEGER NOT NULL DEFAULT 0,
        is_required BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS cafe_tables (
        id SERIAL PRIMARY KEY,
        table_number VARCHAR(32) NOT NULL UNIQUE,
        qr_token VARCHAR(128) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS promos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(180) NOT NULL,
        subtitle VARCHAR(255) NOT NULL DEFAULT '',
        discount_text VARCHAR(80) NOT NULL DEFAULT '',
        banner_image_url TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        valid_until TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS vouchers (
        id SERIAL PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        discount_type discount_type NOT NULL,
        discount_value INTEGER NOT NULL,
        min_order_amount INTEGER NOT NULL DEFAULT 0,
        max_discount_amount INTEGER,
        usage_limit INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_until TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_code VARCHAR(32) NOT NULL UNIQUE,
        customer_name VARCHAR(150) NOT NULL,
        customer_phone VARCHAR(40) NOT NULL,
        order_type order_type NOT NULL DEFAULT 'Dine-In',
        table_number VARCHAR(32),
        items_json JSONB NOT NULL,
        subtotal INTEGER NOT NULL,
        voucher_code VARCHAR(64),
        discount_amount INTEGER NOT NULL DEFAULT 0,
        total_amount INTEGER NOT NULL,
        payment_method payment_method NOT NULL DEFAULT 'Cash',
        order_status order_status NOT NULL DEFAULT 'Pending',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_name VARCHAR(120) NOT NULL,
        action_type VARCHAR(64) NOT NULL,
        target_entity VARCHAR(120) NOT NULL,
        details_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS store_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        cafe_name VARCHAR(160) NOT NULL,
        tagline VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        maps_embed_url TEXT NOT NULL,
        opening_hours VARCHAR(160) NOT NULL,
        whatsapp_number VARCHAR(40) NOT NULL,
        is_open_now BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(160) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Safe migration completed successfully.");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
