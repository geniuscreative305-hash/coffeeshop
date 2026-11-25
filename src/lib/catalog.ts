import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";
import {
  db,
  categories,
  products,
  productVariants,
  promos,
  storeSettings,
  vouchers,
  cafeTables,
} from "@/db";

export interface CatalogVariant {
  id: number;
  productId: number;
  groupName: string;
  optionName: string;
  additionalPrice: number;
  isRequired: boolean;
}

export interface CatalogProduct {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice: number | null;
  imageUrl: string;
  badgeLabel: string | null;
  isLimitedStock: boolean;
  dailyQuota: number;
  remainingStock: number;
  isAvailable: boolean;
  variants: CatalogVariant[];
}

export interface CatalogCategory {
  id: number;
  name: string;
  slug: string;
  iconName: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogPromo {
  id: number;
  title: string;
  subtitle: string;
  discountText: string;
  bannerImageUrl: string;
  isActive: boolean;
  validUntil: string | null;
}

export interface CatalogVoucher {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  validUntil: string;
}

export interface CatalogStoreSettings {
  cafeName: string;
  tagline: string;
  address: string;
  mapsEmbedUrl: string;
  openingHours: string;
  whatsappNumber: string;
  isOpenNow: boolean;
}

export interface PublicCatalogData {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  promos: CatalogPromo[];
  vouchers: CatalogVoucher[];
  tables: string[];
  settings: CatalogStoreSettings;
}

const DEFAULT_SETTINGS: CatalogStoreSettings = {
  cafeName: "Brew & Bliss Coffee House",
  tagline: "Good Coffee, Good Vibes — Freshly brewed specialty coffee every day.",
  address: "Jl. Kemang Raya No. 88, Jakarta Selatan 12730",
  mapsEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.0537!2d106.813!3d-6.260!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwMTUnMzYuMCJTIDEwNsKwNDgnNDYuOCJF!5e0!3m2!1sid!2sid!4v1700000000000",
  openingHours: "Setiap Hari, 07:00 – 22:00 WIB",
  whatsappNumber: "6281234567890",
  isOpenNow: true,
};

async function fetchCatalogFromDb(): Promise<PublicCatalogData> {
  if (!process.env.DATABASE_URL) {
    return {
      categories: [],
      products: [],
      promos: [],
      vouchers: [],
      tables: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  const [catRows, prodRows, variantRows, promoRows, voucherRows, tableRows, settingsRows] =
    await Promise.all([
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.id)),
      db.select().from(products).orderBy(asc(products.id)),
      db.select().from(productVariants).orderBy(asc(productVariants.id)),
      db.select().from(promos).where(eq(promos.isActive, true)).orderBy(asc(promos.id)),
      db.select().from(vouchers).where(eq(vouchers.isActive, true)).orderBy(asc(vouchers.id)),
      db.select().from(cafeTables).where(eq(cafeTables.isActive, true)),
      db.select().from(storeSettings).limit(1),
    ]);

  const variantsByProduct = new Map<number, CatalogVariant[]>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push({
      id: v.id,
      productId: v.productId,
      groupName: v.groupName,
      optionName: v.optionName,
      additionalPrice: v.additionalPrice,
      isRequired: v.isRequired,
    });
    variantsByProduct.set(v.productId, list);
  }

  const now = new Date();
  const activeVouchers: CatalogVoucher[] = voucherRows
    .filter((v) => v.validUntil > now && (v.usageLimit === null || v.usedCount < v.usageLimit))
    .map((v) => ({
      id: v.id,
      code: v.code,
      discountType: v.discountType,
      discountValue: v.discountValue,
      minOrderAmount: v.minOrderAmount,
      maxDiscountAmount: v.maxDiscountAmount,
      validUntil: v.validUntil.toISOString(),
    }));

  return {
    categories: catRows,
    products: prodRows.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      discountPrice: p.discountPrice,
      imageUrl: p.imageUrl,
      badgeLabel: p.badgeLabel,
      isLimitedStock: p.isLimitedStock,
      dailyQuota: p.dailyQuota,
      remainingStock: p.remainingStock,
      isAvailable: p.isAvailable,
      variants: variantsByProduct.get(p.id) ?? [],
    })),
    promos: promoRows.map((pr) => ({
      id: pr.id,
      title: pr.title,
      subtitle: pr.subtitle,
      discountText: pr.discountText,
      bannerImageUrl: pr.bannerImageUrl,
      isActive: pr.isActive,
      validUntil: pr.validUntil ? pr.validUntil.toISOString() : null,
    })),
    vouchers: activeVouchers,
    tables: tableRows.map((t) => t.tableNumber),
    settings: settingsRows[0] ?? DEFAULT_SETTINGS,
  };
}

export const getCachedCatalog = unstable_cache(
  async () => fetchCatalogFromDb(),
  ["public-catalog-v1"],
  { tags: ["catalog"], revalidate: 300 }
);
