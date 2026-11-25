import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed"]);
export const orderTypeEnum = pgEnum("order_type", ["Dine-In", "Pickup", "Delivery"]);
export const paymentMethodEnum = pgEnum("payment_method", ["Cash", "QRIS", "Transfer"]);
export const orderStatusEnum = pgEnum("order_status", [
  "Pending",
  "Brewing",
  "Ready",
  "Completed",
  "Cancelled",
]);

// Types for JSONB columns
export interface OrderItemVariant {
  group_name: string;
  option_name: string;
  additional_price: number;
}

export interface OrderItemJson {
  product_id: number;
  name: string;
  category_name: string;
  qty: number;
  base_price: number;
  selected_variants: OrderItemVariant[];
  item_total: number;
}

export interface AuditDetailsJson {
  before?: unknown;
  after?: unknown;
  note?: string;
}

// 1. categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  iconName: varchar("icon_name", { length: 64 }).notNull().default("Coffee"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// 2. products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull(),
  discountPrice: integer("discount_price"),
  imageUrl: text("image_url").notNull(),
  badgeLabel: varchar("badge_label", { length: 64 }),
  isLimitedStock: boolean("is_limited_stock").notNull().default(false),
  dailyQuota: integer("daily_quota").notNull().default(0),
  remainingStock: integer("remaining_stock").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. product_variants
export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  groupName: varchar("group_name", { length: 100 }).notNull(),
  optionName: varchar("option_name", { length: 120 }).notNull(),
  additionalPrice: integer("additional_price").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(false),
});

// 4. cafe_tables
export const cafeTables = pgTable("cafe_tables", {
  id: serial("id").primaryKey(),
  tableNumber: varchar("table_number", { length: 32 }).notNull().unique(),
  qrToken: varchar("qr_token", { length: 128 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// 5. promos
export const promos = pgTable("promos", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }).notNull().default(""),
  discountText: varchar("discount_text", { length: 80 }).notNull().default(""),
  bannerImageUrl: text("banner_image_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  validUntil: timestamp("valid_until", { withTimezone: true }),
});

// 6. vouchers
export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  minOrderAmount: integer("min_order_amount").notNull().default(0),
  maxDiscountAmount: integer("max_discount_amount"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// 7. orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderCode: varchar("order_code", { length: 32 }).notNull().unique(),
  customerName: varchar("customer_name", { length: 150 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
  orderType: orderTypeEnum("order_type").notNull().default("Dine-In"),
  tableNumber: varchar("table_number", { length: 32 }),
  itemsJson: jsonb("items_json").$type<OrderItemJson[]>().notNull(),
  subtotal: integer("subtotal").notNull(),
  voucherCode: varchar("voucher_code", { length: 64 }),
  discountAmount: integer("discount_amount").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("Cash"),
  orderStatus: orderStatusEnum("order_status").notNull().default("Pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 8. audit_logs
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorName: varchar("actor_name", { length: 120 }).notNull(),
  actionType: varchar("action_type", { length: 64 }).notNull(),
  targetEntity: varchar("target_entity", { length: 120 }).notNull(),
  detailsJson: jsonb("details_json").$type<AuditDetailsJson>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 9. store_settings
export const storeSettings = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  cafeName: varchar("cafe_name", { length: 160 }).notNull(),
  tagline: varchar("tagline", { length: 255 }).notNull(),
  address: text("address").notNull(),
  mapsEmbedUrl: text("maps_embed_url").notNull(),
  openingHours: varchar("opening_hours", { length: 160 }).notNull(),
  whatsappNumber: varchar("whatsapp_number", { length: 40 }).notNull(),
  isOpenNow: boolean("is_open_now").notNull().default(true),
});

// 10. admin_users (for secure /admin cookie auth)
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));
