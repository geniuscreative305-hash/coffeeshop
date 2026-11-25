import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  db,
  categories,
  products,
  productVariants,
  cafeTables,
  promos,
  vouchers,
  storeSettings,
  adminUsers,
} from "./index";

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run db:seed");
  }

  console.log("Seeding Brew & Bliss Coffee House database (idempotent)...");

  // 1. Store Settings (id = 1)
  await db
    .insert(storeSettings)
    .values({
      id: 1,
      cafeName: "Brew & Bliss Coffee House",
      tagline: "Good Coffee, Good Vibes — Freshly brewed specialty coffee every day.",
      address: "Jl. Kemang Raya No. 88, Jakarta Selatan 12730",
      mapsEmbedUrl:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.0537!2d106.813!3d-6.260!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwMTUnMzYuMCJTIDEwNsKwNDgnNDYuOCJF!5e0!3m2!1sid!2sid!4v1700000000000",
      openingHours: "Setiap Hari, 07:00 – 22:00 WIB",
      whatsappNumber: "6281234567890",
      isOpenNow: true,
    })
    .onConflictDoNothing({ target: storeSettings.id });

  // 2. Default Admin User
  const adminEmail = (process.env.ADMIN_DEFAULT_EMAIL || "admin@coffee.id").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || "BrewBlissAdmin2026!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await db
    .insert(adminUsers)
    .values({
      email: adminEmail,
      name: "Head Barista & Admin",
      passwordHash,
    })
    .onConflictDoNothing({ target: adminUsers.email });

  // 3. 6 Categories
  const categoryData = [
    { name: "Coffee", slug: "coffee", iconName: "Coffee", sortOrder: 1 },
    { name: "Non-Coffee", slug: "non-coffee", iconName: "CupSoda", sortOrder: 2 },
    { name: "Pastries", slug: "pastries", iconName: "Croissant", sortOrder: 3 },
    { name: "Sandwiches", slug: "sandwiches", iconName: "Sandwich", sortOrder: 4 },
    { name: "Desserts", slug: "desserts", iconName: "CakeSlice", sortOrder: 5 },
    { name: "Breakfast", slug: "breakfast", iconName: "EggFried", sortOrder: 6 },
  ];

  for (const cat of categoryData) {
    await db
      .insert(categories)
      .values({ ...cat, isActive: true })
      .onConflictDoNothing({ target: categories.slug });
  }

  const allCats = await db.select().from(categories);
  const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));

  // 4. 10 Sample Products (including 2 limited stock items)
  const productSeeds = [
    {
      categorySlug: "coffee",
      name: "Signature Cappuccino",
      slug: "signature-cappuccino",
      description: "Double shot espresso Arabika Gayo dengan susu steamed lembut dan microfoam klasik.",
      price: 34000,
      discountPrice: 29000,
      imageUrl: "/images/seed/cappuccino.svg",
      badgeLabel: "Bestseller",
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: true,
    },
    {
      categorySlug: "coffee",
      name: "Caramel Macchiato",
      slug: "caramel-macchiato",
      description: "Perpaduan espresso, susu segar, sirup vanila, dan saus karamel buatan rumah.",
      price: 38000,
      discountPrice: null,
      imageUrl: "/images/seed/caramel-macchiato.svg",
      badgeLabel: "Signature",
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: true,
    },
    {
      categorySlug: "coffee",
      name: "Aren Oat Latte",
      slug: "aren-oat-latte",
      description: "Kopi susu gula aren organik dengan pilihan oat milk creamy yang ramah lambung.",
      price: 36000,
      discountPrice: null,
      imageUrl: "/images/seed/aren-latte.svg",
      badgeLabel: "Bestseller",
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: true,
    },
    {
      categorySlug: "non-coffee",
      name: "Uji Matcha Latte",
      slug: "uji-matcha-latte",
      description: "Ceremonial grade matcha asal Uji Jepang dikocok dengan susu segar dingin atau hangat.",
      price: 37000,
      discountPrice: null,
      imageUrl: "/images/seed/matcha-latte.svg",
      badgeLabel: "Signature",
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: true,
    },
    {
      categorySlug: "non-coffee",
      name: "Belgian Dark Chocolate",
      slug: "belgian-dark-chocolate",
      description: "Cokelat hitam Belgia 70% yang pekat, creamy, dan menenangkan.",
      price: 35000,
      discountPrice: null,
      imageUrl: "/images/seed/dark-chocolate.svg",
      badgeLabel: null,
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: true,
    },
    {
      categorySlug: "pastries",
      name: "Butter Croissant",
      slug: "butter-croissant",
      description: "Croissant panggang segar setiap pagi dengan French butter berlapis renyah.",
      price: 28000,
      discountPrice: null,
      imageUrl: "/images/seed/butter-croissant.svg",
      badgeLabel: "Chef's Pick",
      isLimitedStock: true,
      dailyQuota: 20,
      remainingStock: 20,
      hasCoffeeVariants: false,
    },
    {
      categorySlug: "pastries",
      name: "Chocolate Muffin",
      slug: "chocolate-muffin",
      description: "Muffin cokelat lembut dengan choco chips melimpah, dipanggang hangat.",
      price: 26000,
      discountPrice: 23000,
      imageUrl: "/images/seed/chocolate-muffin.svg",
      badgeLabel: "Chef's Pick",
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: false,
    },
    {
      categorySlug: "sandwiches",
      name: "Chicken Club Sandwich",
      slug: "chicken-club-sandwich",
      description: "Roti panggang gandum isi ayam panggang herb, selada segar, tomat, dan saus spesial.",
      price: 48000,
      discountPrice: null,
      imageUrl: "/images/seed/chicken-sandwich.svg",
      badgeLabel: "Popular",
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: false,
    },
    {
      categorySlug: "desserts",
      name: "Tiramisu Slice",
      slug: "tiramisu-slice",
      description: "Mascarpone lembut berpadu ladyfinger espresso dan taburan kakao premium.",
      price: 42000,
      discountPrice: null,
      imageUrl: "/images/seed/tiramisu-slice.svg",
      badgeLabel: "Limited",
      isLimitedStock: true,
      dailyQuota: 10,
      remainingStock: 10,
      hasCoffeeVariants: false,
    },
    {
      categorySlug: "breakfast",
      name: "Artisan Scrambled Egg Toast",
      slug: "artisan-scrambled-egg-toast",
      description: "Sourdough panggang dengan scrambled egg lembut, keju cheddar, dan smoked beef.",
      price: 45000,
      discountPrice: null,
      imageUrl: "/images/seed/breakfast-toast.svg",
      badgeLabel: "Morning Pick",
      isLimitedStock: false,
      dailyQuota: 0,
      remainingStock: 0,
      hasCoffeeVariants: false,
    },
  ];

  for (const item of productSeeds) {
    const categoryId = catBySlug.get(item.categorySlug);
    if (!categoryId) continue;

    await db
      .insert(products)
      .values({
        categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        price: item.price,
        discountPrice: item.discountPrice,
        imageUrl: item.imageUrl,
        badgeLabel: item.badgeLabel,
        isLimitedStock: item.isLimitedStock,
        dailyQuota: item.dailyQuota,
        remainingStock: item.remainingStock,
        isAvailable: true,
      })
      .onConflictDoNothing({ target: products.slug });

    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.slug, item.slug))
      .limit(1);

    if (prod) {
      const existingVars = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, prod.id));

      if (existingVars.length === 0 && item.hasCoffeeVariants) {
        await db.insert(productVariants).values([
          { productId: prod.id, groupName: "Suhu", optionName: "Hot", additionalPrice: 0, isRequired: true },
          { productId: prod.id, groupName: "Suhu", optionName: "Ice", additionalPrice: 2000, isRequired: true },
          { productId: prod.id, groupName: "Tingkat Gula", optionName: "Normal Sugar", additionalPrice: 0, isRequired: true },
          { productId: prod.id, groupName: "Tingkat Gula", optionName: "Less Sugar", additionalPrice: 0, isRequired: true },
          { productId: prod.id, groupName: "Extra Topping", optionName: "Extra Espresso Shot", additionalPrice: 6000, isRequired: false },
          { productId: prod.id, groupName: "Extra Topping", optionName: "Oat Milk Upgrade", additionalPrice: 8000, isRequired: false },
        ]);
      } else if (existingVars.length === 0 && !item.hasCoffeeVariants) {
        await db.insert(productVariants).values([
          { productId: prod.id, groupName: "Penyajian", optionName: "Hangat / Dipanaskan", additionalPrice: 0, isRequired: false },
        ]);
      }
    }
  }

  // 5. 5 Cafe Tables (01 - 05)
  for (const num of ["01", "02", "03", "04", "05"]) {
    await db
      .insert(cafeTables)
      .values({
        tableNumber: num,
        qrToken: crypto.createHash("sha256").update(`table-${num}-brewbliss`).digest("hex").slice(0, 16),
        isActive: true,
      })
      .onConflictDoNothing({ target: cafeTables.tableNumber });
  }

  // 6. 2 Active Promo Banners
  const existingPromos = await db.select().from(promos);
  if (existingPromos.length === 0) {
    await db.insert(promos).values([
      {
        title: "Good Coffee, Good Vibes",
        subtitle: "Nikmati kopi spesialti seduhan segar setiap pagi untuk menemani harimu.",
        discountText: "15% OFF",
        bannerImageUrl: "/images/seed/promo-morning.svg",
        isActive: true,
        validUntil: new Date(Date.now() + 90 * 86400 * 1000),
      },
      {
        title: "Weekend Pastry Pairing",
        subtitle: "Potongan langsung Rp 5.000 untuk setiap pembelian kopi + pastry pilihan.",
        discountText: "HEMAT Rp 5K",
        bannerImageUrl: "/images/seed/promo-weekend.svg",
        isActive: true,
        validUntil: new Date(Date.now() + 90 * 86400 * 1000),
      },
    ]);
  }

  // 7. 2 Active Vouchers
  const validFrom = new Date();
  const validUntil = new Date(Date.now() + 180 * 86400 * 1000);

  await db
    .insert(vouchers)
    .values({
      code: "NGOPIPAGI",
      discountType: "percentage",
      discountValue: 15,
      minOrderAmount: 30000,
      maxDiscountAmount: 15000,
      usageLimit: 500,
      usedCount: 0,
      validFrom,
      validUntil,
      isActive: true,
    })
    .onConflictDoNothing({ target: vouchers.code });

  await db
    .insert(vouchers)
    .values({
      code: "HEMAT5K",
      discountType: "fixed",
      discountValue: 5000,
      minOrderAmount: 25000,
      maxDiscountAmount: null,
      usageLimit: 500,
      usedCount: 0,
      validFrom,
      validUntil,
      isActive: true,
    })
    .onConflictDoNothing({ target: vouchers.code });

  console.log("Seed completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
