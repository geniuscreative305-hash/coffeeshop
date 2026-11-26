"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ShoppingBag,
  Home,
  BookOpen,
  Gift,
  Info,
  Plus,
  MapPin,
  Clock,
  Phone,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Coffee,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  PublicCatalogData,
  CatalogProduct,
} from "@/lib/catalog";
import type { CartItem, SelectedVariant } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { toSafeMapEmbedUrl } from "@/lib/maps";
import { useToast } from "@/components/ui/ToastProvider";
import { CategoryIcon } from "./CategoryIcon";
import { VariantModal } from "./VariantModal";
import { CartDrawer } from "./CartDrawer";

type MobileTab = "home" | "menu" | "promo" | "info";

interface StorefrontClientProps {
  initialCatalog: PublicCatalogData;
  initialTableParam: string | null;
}

export function StorefrontClient({
  initialCatalog,
  initialTableParam,
}: StorefrontClientProps) {
  const { showToast } = useToast();
  const [catalog] = useState<PublicCatalogData>(initialCatalog);

  // Zero-latency client state
  const [activeCategoryId, setActiveCategoryId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [activePromoIdx, setActivePromoIdx] = useState(0);

  // Cart & Modals
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<CatalogProduct | null>(null);
  const [boundTable, setBoundTable] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Bind QR table from URL or sessionStorage
  useEffect(() => {
    if (initialTableParam) {
      const normalized = initialTableParam.trim().toUpperCase();
      const valid =
        catalog.tables.length === 0 || catalog.tables.includes(normalized);
      if (valid) {
        sessionStorage.setItem("bb_bound_table", normalized);
        setBoundTable(normalized);
        return;
      }
    }
    const saved = sessionStorage.getItem("bb_bound_table");
    if (saved) setBoundTable(saved);
  }, [initialTableParam, catalog.tables]);

  // Auto-advance promo slider
  useEffect(() => {
    if (catalog.promos.length <= 1) return;
    const timer = setInterval(() => {
      setActivePromoIdx((idx) => (idx + 1) % catalog.promos.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [catalog.promos.length]);

  const categoryNameMap = useMemo(() => {
    return new Map(catalog.categories.map((c) => [c.id, c.name]));
  }, [catalog.categories]);

  // 0ms instant filtering
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.products.filter((p) => {
      if (activeCategoryId !== "all" && p.categoryId !== activeCategoryId) return false;
      if (onlyAvailable) {
        if (!p.isAvailable) return false;
        if (p.isLimitedStock && p.remainingStock <= 0) return false;
      }
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [catalog.products, activeCategoryId, onlyAvailable, searchQuery]);

  const featuredProduct = useMemo(() => {
    return (
      catalog.products.find((p) => p.badgeLabel === "Bestseller") ||
      catalog.products[0] ||
      null
    );
  }, [catalog.products]);

  const totalCartQty = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  const totalCartAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitTotal * item.qty, 0),
    [cart]
  );

  const addToCart = (
    product: CatalogProduct,
    categoryName: string,
    selectedVariants: SelectedVariant[],
    qty: number
  ) => {
    const basePrice = product.discountPrice ?? product.price;
    const variantsExtra = selectedVariants.reduce((s, v) => s + v.additional_price, 0);
    const unitTotal = basePrice + variantsExtra;
    const variantKey = selectedVariants
      .map((v) => `${v.group_name}:${v.option_name}`)
      .sort()
      .join("|");
    const cartKey = `${product.id}__${variantKey}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) {
        return prev.map((i) =>
          i.cartKey === cartKey ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [
        ...prev,
        {
          cartKey,
          productId: product.id,
          name: product.name,
          categoryName,
          imageUrl: product.imageUrl,
          basePrice,
          selectedVariants,
          unitTotal,
          qty,
          isLimitedStock: product.isLimitedStock,
          remainingStock: product.remainingStock,
        },
      ];
    });

    showToast(`${product.name} ditambahkan ke keranjang.`, "success");
  };

  const handleQuickAdd = (product: CatalogProduct) => {
    const isSoldOut =
      !product.isAvailable || (product.isLimitedStock && product.remainingStock <= 0);
    if (isSoldOut) return;

    if (product.variants.length > 0) {
      setModalProduct(product);
    } else {
      addToCart(product, categoryNameMap.get(product.categoryId) ?? "Menu", [], 1);
    }
  };

  const handleUpdateQty = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cartKey === cartKey ? { ...item, qty: item.qty + delta } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const handleCopyVoucher = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast(`Kode voucher ${code} disalin!`, "success");
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      showToast(`Kode voucher: ${code}`, "info");
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const renderProductCard = (product: CatalogProduct) => {
    const isSoldOut =
      !product.isAvailable || (product.isLimitedStock && product.remainingStock <= 0);
    const activePrice = product.discountPrice ?? product.price;

    return (
      <article
        key={product.id}
        className="group bg-white rounded-2xl border border-sand shadow-card hover:shadow-card-hover transition-all duration-200 overflow-hidden flex flex-col"
      >
        <div
          onClick={() => !isSoldOut && setModalProduct(product)}
          className="relative aspect-square w-full overflow-hidden bg-cream cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              isSoldOut ? "grayscale opacity-60" : ""
            }`}
          />

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {product.badgeLabel && (
              <span className="px-2.5 py-1 rounded-full bg-espresso/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                {product.badgeLabel}
              </span>
            )}
            {product.isLimitedStock && product.remainingStock > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100/95 text-espresso border border-amber-300 text-[10px] font-bold">
                Sisa {product.remainingStock} porsi
              </span>
            )}
          </div>

          {isSoldOut && (
            <div className="absolute inset-0 bg-ink/45 flex items-center justify-center">
              <span className="px-3.5 py-1.5 rounded-full bg-white text-ink text-xs font-bold uppercase tracking-wider shadow">
                Sold Out
              </span>
            </div>
          )}
        </div>

        <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
          <div
            onClick={() => !isSoldOut && setModalProduct(product)}
            className="cursor-pointer"
          >
            <h3 className="font-serif text-sm sm:text-base font-bold text-ink leading-snug line-clamp-1">
              {product.name}
            </h3>
            <p className="text-xs text-ink-muted mt-1 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm sm:text-base font-bold text-espresso">
                {formatRupiah(activePrice)}
              </p>
              {product.discountPrice && (
                <p className="text-[11px] line-through text-ink-muted">
                  {formatRupiah(product.price)}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={isSoldOut}
              onClick={() => handleQuickAdd(product)}
              aria-label={`Tambah ${product.name}`}
              className="w-9 h-9 rounded-full bg-espresso hover:bg-espresso-hover text-white flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-cream text-ink pb-24 lg:pb-12">
      {/* ====================================================================
          MOBILE & TABLET MINIMALIST TOP HEADER (< 1024px)
      ==================================================================== */}
      <header className="lg:hidden sticky top-0 z-40 bg-cream/95 backdrop-blur-md border-b border-sand px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-espresso text-white flex items-center justify-center shrink-0">
            <Coffee className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-base font-bold text-ink truncate leading-tight">
              {catalog.settings.cafeName}
            </h1>
            <p className="text-[11px] text-ink-muted truncate">
              {catalog.settings.isOpenNow ? "Buka Sekarang" : "Sedang Tutup"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {boundTable && (
            <span className="px-2.5 py-1 rounded-full bg-espresso/10 text-espresso text-xs font-bold border border-espresso/20">
              Meja {boundTable}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 rounded-full bg-white border border-sand text-espresso shadow-xs"
            aria-label="Buka keranjang"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalCartQty > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-caramel text-white text-[10px] font-bold flex items-center justify-center">
                {totalCartQty}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ====================================================================
          DESKTOP FULL-WIDTH TOP NAVIGATION BAR (>= 1024px)
      ==================================================================== */}
      <header className="hidden lg:flex sticky top-0 z-40 w-full px-6 xl:px-10 py-3.5 bg-cream/95 backdrop-blur-md border-b border-sand items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-espresso text-white flex items-center justify-center shadow-xs">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold text-ink block leading-none">
              {catalog.settings.cafeName}
            </span>
            <span className="text-[11px] tracking-wider uppercase text-caramel font-semibold">
              Specialty Coffee House
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-8 text-sm font-semibold text-ink-muted">
          <button
            type="button"
            onClick={() => scrollToSection("hero-desktop")}
            className="hover:text-espresso transition-colors"
          >
            Beranda
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("menu-desktop")}
            className="hover:text-espresso transition-colors"
          >
            Menu Kami
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("promo-desktop")}
            className="hover:text-espresso transition-colors"
          >
            Promo &amp; Voucher
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("info-desktop")}
            className="hover:text-espresso transition-colors"
          >
            Lokasi &amp; Jam Buka
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              catalog.settings.isOpenNow
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                catalog.settings.isOpenNow ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {catalog.settings.isOpenNow ? "Buka Sekarang" : "Tutup"}
          </span>

          {boundTable && (
            <span className="px-3 py-1.5 rounded-full bg-espresso/10 text-espresso text-xs font-bold border border-espresso/20">
              Meja {boundTable}
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Keranjang Saya</span>
            <span className="px-2 py-0.5 rounded-md bg-white/15 text-xs font-bold">
              {totalCartQty > 0 ? formatRupiah(totalCartAmount) : "0"}
            </span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          MOBILE VIEWPORT CONTENT (< 1024px)
      ==================================================================== */}
      <main className="lg:hidden px-4 pt-4 space-y-6">
        {(mobileTab === "home" || mobileTab === "menu") && (
          <>
            {/* Rounded Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kopi, pastry, atau makanan..."
                className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-sand text-sm shadow-xs focus:outline-none focus:border-espresso"
              />
            </div>
          </>
        )}

        {mobileTab === "home" && (
          <>
            {/* Hero Promo Banner Slider (16:9) */}
            {catalog.promos.length > 0 && (
              <section className="space-y-2.5">
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-sand shadow-card bg-espresso">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={catalog.promos[activePromoIdx].bannerImageUrl}
                    alt={catalog.promos[activePromoIdx].title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/50 to-transparent p-5 flex flex-col justify-end text-white">
                    {catalog.promos[activePromoIdx].discountText && (
                      <span className="inline-block w-fit px-2.5 py-0.5 rounded-full bg-caramel text-[10px] font-bold uppercase tracking-wider mb-1.5">
                        {catalog.promos[activePromoIdx].discountText}
                      </span>
                    )}
                    <h2 className="font-serif text-xl font-bold leading-tight">
                      {catalog.promos[activePromoIdx].title}
                    </h2>
                    <p className="text-xs text-cream/85 mt-1 line-clamp-2 max-w-[85%]">
                      {catalog.promos[activePromoIdx].subtitle}
                    </p>
                  </div>
                </div>

                {catalog.promos.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {catalog.promos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActivePromoIdx(idx)}
                        aria-label={`Slide ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === activePromoIdx ? "w-6 bg-espresso" : "w-1.5 bg-sand"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {(mobileTab === "home" || mobileTab === "menu") && (
          <>
            {/* Horizontal Scrollable Category Pills */}
            <section className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setActiveCategoryId("all")}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                    activeCategoryId === "all"
                      ? "bg-espresso text-white border-espresso shadow-sm"
                      : "bg-white text-ink border-sand"
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </span>
                <span className="text-[11px] font-semibold">Semua</span>
              </button>

              {catalog.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <span
                    className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                      activeCategoryId === cat.id
                        ? "bg-espresso text-white border-espresso shadow-sm"
                        : "bg-white text-ink border-sand"
                    }`}
                  >
                    <CategoryIcon name={cat.iconName} />
                  </span>
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    {cat.name}
                  </span>
                </button>
              ))}
            </section>

            {/* 2-Column Mobile Product Grid */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold text-ink">
                  {activeCategoryId === "all"
                    ? "Menu Pilihan"
                    : categoryNameMap.get(activeCategoryId) ?? "Menu"}
                </h2>
                <button
                  type="button"
                  onClick={() => setOnlyAvailable((v) => !v)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                    onlyAvailable
                      ? "bg-espresso text-white border-espresso"
                      : "bg-white text-ink-muted border-sand"
                  }`}
                >
                  Tersedia Saja
                </button>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-sand p-8 text-center text-sm text-ink-muted">
                  Tidak ada menu yang sesuai pencarian Anda.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5">
                  {filteredProducts.map(renderProductCard)}
                </div>
              )}
            </section>
          </>
        )}

        {mobileTab === "promo" && (
          <section className="space-y-5">
            <h2 className="font-serif text-xl font-bold text-ink">Promo &amp; Voucher</h2>

            <div className="space-y-3">
              {catalog.vouchers.map((v) => (
                <div
                  key={v.id}
                  className="bg-white rounded-2xl border border-sand p-4 shadow-card flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-100 text-espresso font-mono text-xs font-bold">
                      {v.code}
                    </span>
                    <p className="text-sm font-bold text-ink mt-1.5">
                      {v.discountType === "percentage"
                        ? `Diskon ${v.discountValue}%`
                        : `Potongan ${formatRupiah(v.discountValue)}`}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Min. belanja {formatRupiah(v.minOrderAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyVoucher(v.code)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-espresso text-white text-xs font-semibold shrink-0"
                  >
                    {copiedCode === v.code ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Disalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Salin
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {catalog.promos.map((pr) => (
                <div
                  key={pr.id}
                  className="bg-white rounded-2xl border border-sand overflow-hidden shadow-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pr.bannerImageUrl}
                    alt={pr.title}
                    className="aspect-video w-full object-cover"
                  />
                  <div className="p-4">
                    <span className="text-[11px] font-bold uppercase text-caramel">
                      {pr.discountText}
                    </span>
                    <h3 className="font-serif text-base font-bold text-ink">{pr.title}</h3>
                    <p className="text-xs text-ink-muted mt-1">{pr.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {mobileTab === "info" && (
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-ink">Informasi Kafe</h2>
            <div className="bg-white rounded-2xl border border-sand p-5 shadow-card space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-caramel shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">Alamat</p>
                  <p className="text-sm text-ink mt-0.5">{catalog.settings.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-caramel shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">Jam Operasional</p>
                  <p className="text-sm text-ink mt-0.5">{catalog.settings.openingHours}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-caramel shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">WhatsApp Kasir</p>
                  <p className="text-sm text-ink mt-0.5">+{catalog.settings.whatsappNumber}</p>
                </div>
              </div>
            </div>

            {toSafeMapEmbedUrl(catalog.settings.mapsEmbedUrl, catalog.settings.address) && (
              <div className="rounded-2xl overflow-hidden border border-sand shadow-card aspect-video bg-white">
                <iframe
                  src={toSafeMapEmbedUrl(catalog.settings.mapsEmbedUrl, catalog.settings.address)}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Lokasi Kafe"
                />
              </div>
            )}
          </section>
        )}
      </main>

      {/* ====================================================================
          MOBILE FIXED BOTTOM FOOTER NAVIGATION BAR (< 1024px)
      ==================================================================== */}
      <nav
        aria-label="Navigasi Bawah"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-sand pb-safe shadow-[0_-4px_20px_rgba(74,44,24,0.08)]"
      >
        <div className="grid grid-cols-5 items-end px-2 py-2">
          <button
            type="button"
            onClick={() => setMobileTab("home")}
            className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-colors ${
              mobileTab === "home" ? "text-espresso" : "text-ink-muted"
            }`}
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab("menu")}
            className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-colors ${
              mobileTab === "menu" ? "text-espresso" : "text-ink-muted"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>Menu</span>
          </button>

          <div className="flex flex-col items-center justify-end">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label="Keranjang Pesanan"
              className="relative -mt-6 w-14 h-14 rounded-full bg-espresso hover:bg-espresso-hover text-white flex items-center justify-center shadow-lg border-4 border-cream transition-transform active:scale-95"
            >
              <ShoppingBag className="w-6 h-6" />
              {totalCartQty > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-caramel text-white text-[10px] font-bold flex items-center justify-center border border-white">
                  {totalCartQty}
                </span>
              )}
            </button>
            <span className="text-[11px] font-bold text-espresso mt-0.5">Order</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileTab("promo")}
            className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-colors ${
              mobileTab === "promo" ? "text-espresso" : "text-ink-muted"
            }`}
          >
            <Gift className="w-5 h-5" />
            <span>Promo</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab("info")}
            className={`flex flex-col items-center gap-1 py-1 text-[11px] font-semibold transition-colors ${
              mobileTab === "info" ? "text-espresso" : "text-ink-muted"
            }`}
          >
            <Info className="w-5 h-5" />
            <span>Info</span>
          </button>
        </div>
      </nav>

      {/* ====================================================================
          DESKTOP FULL-WIDTH EDGE-TO-EDGE LAYOUT (>= 1024px)
      ==================================================================== */}
      <main className="hidden lg:block w-full">
        {/* Full-Width Split Hero Section */}
        <section
          id="hero-desktop"
          className="w-full px-6 xl:px-10 py-8 xl:py-10 grid grid-cols-12 gap-8 items-center border-b border-sand bg-gradient-to-br from-cream via-white to-cream"
        >
          <div className="col-span-6 xl:col-span-7 space-y-5 pr-4">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-espresso/10 text-espresso text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Artisanal Roastery &amp; Bakery
            </span>
            <h1 className="font-serif text-4xl xl:text-5xl font-bold text-ink leading-[1.15]">
              {catalog.settings.tagline}
            </h1>
            <p className="text-base xl:text-lg text-ink-muted max-w-2xl leading-relaxed">
              Setiap cangkir diseduh segar dari biji kopi pilihan Nusantara bersama pastry
              panggang hangat setiap pagi. Pesan langsung dari meja Anda atau ambil tanpa
              antre.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => scrollToSection("menu-desktop")}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <span>Jelajahi Menu Kami</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("promo-desktop")}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-sand hover:border-caramel text-ink text-sm font-semibold transition-colors"
              >
                <Gift className="w-4 h-4 text-caramel" />
                <span>Lihat Promo &amp; Voucher</span>
              </button>
            </div>
          </div>

          <div className="col-span-6 xl:col-span-5 relative">
            {catalog.promos.length > 0 ? (
              <div className="relative aspect-video w-full rounded-3xl overflow-hidden border border-sand shadow-xl bg-espresso">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={catalog.promos[activePromoIdx].bannerImageUrl}
                  alt={catalog.promos[activePromoIdx].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent p-6 flex flex-col justify-end text-white">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    {catalog.promos[activePromoIdx].discountText}
                  </span>
                  <h2 className="font-serif text-2xl font-bold">
                    {catalog.promos[activePromoIdx].title}
                  </h2>
                  <p className="text-xs text-cream/90 mt-1">
                    {catalog.promos[activePromoIdx].subtitle}
                  </p>
                </div>

                {catalog.promos.length > 1 && (
                  <div className="absolute top-4 right-4 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setActivePromoIdx(
                          (i) => (i - 1 + catalog.promos.length) % catalog.promos.length
                        )
                      }
                      className="w-8 h-8 rounded-full bg-white/85 text-ink flex items-center justify-center hover:bg-white"
                      aria-label="Promo sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePromoIdx((i) => (i + 1) % catalog.promos.length)
                      }
                      className="w-8 h-8 rounded-full bg-white/85 text-ink flex items-center justify-center hover:bg-white"
                      aria-label="Promo berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {featuredProduct && (
              <div
                onClick={() => handleQuickAdd(featuredProduct)}
                className="mt-4 bg-white rounded-2xl border border-sand shadow-card p-3.5 flex items-center gap-3.5 cursor-pointer hover:border-caramel transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredProduct.imageUrl}
                  alt={featuredProduct.name}
                  className="w-14 h-14 rounded-xl object-cover border border-sand shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-caramel">
                    Favorit Hari Ini
                  </span>
                  <p className="font-serif text-sm font-bold text-ink truncate">
                    {featuredProduct.name}
                  </p>
                  <p className="text-xs font-bold text-espresso">
                    {formatRupiah(featuredProduct.discountPrice ?? featuredProduct.price)}
                  </p>
                </div>
                <span className="w-9 h-9 rounded-full bg-espresso text-white flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Full-Width Desktop Menu Workspace (Sticky Left Sidebar + Fluid Auto-Fill Grid) */}
        <section
          id="menu-desktop"
          className="w-full px-6 xl:px-10 py-10 flex items-start gap-8"
        >
          {/* Sticky Left Sidebar */}
          <aside className="w-64 shrink-0 sticky top-24 bg-white rounded-2xl border border-sand shadow-card p-5 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Cari Menu
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama menu..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-sand bg-cream/50 text-sm focus:outline-none focus:border-espresso"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                Kategori
              </p>
              <button
                type="button"
                onClick={() => setActiveCategoryId("all")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeCategoryId === "all"
                    ? "bg-espresso text-white shadow-xs"
                    : "text-ink hover:bg-cream"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Semua Menu</span>
              </button>

              {catalog.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeCategoryId === cat.id
                      ? "bg-espresso text-white shadow-xs"
                      : "text-ink hover:bg-cream"
                  }`}
                >
                  <CategoryIcon name={cat.iconName} className="w-4 h-4" />
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-sand">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="w-4 h-4 accent-espresso rounded"
                />
                <span>Hanya stok tersedia</span>
              </label>
            </div>
          </aside>

          {/* Fluid Auto-Fill Product Grid */}
          <div className="flex-1 min-w-0 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold text-ink">
                  {activeCategoryId === "all"
                    ? "Katalog Menu Lengkap"
                    : categoryNameMap.get(activeCategoryId) ?? "Menu"}
                </h2>
                <p className="text-sm text-ink-muted">
                  Menampilkan {filteredProducts.length} pilihan menu spesial
                </p>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-sand p-12 text-center text-ink-muted">
                Tidak ada menu yang cocok dengan filter Anda.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
                {filteredProducts.map(renderProductCard)}
              </div>
            )}
          </div>
        </section>

        {/* Full-Width Promo & Voucher Section */}
        <section
          id="promo-desktop"
          className="w-full px-6 xl:px-10 py-10 border-t border-sand bg-white/60 space-y-6"
        >
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">
              Promo &amp; Voucher Spesial
            </h2>
            <p className="text-sm text-ink-muted">
              Salin kode voucher berikut dan gunakan langsung di keranjang Anda.
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {catalog.vouchers.map((v) => (
              <div
                key={v.id}
                className="bg-white rounded-2xl border border-sand p-5 shadow-card flex items-center justify-between gap-4"
              >
                <div>
                  <span className="inline-block px-3 py-1 rounded-lg bg-amber-100 text-espresso font-mono text-xs font-bold">
                    {v.code}
                  </span>
                  <p className="text-base font-bold text-ink mt-2">
                    {v.discountType === "percentage"
                      ? `Diskon ${v.discountValue}%`
                      : `Potongan ${formatRupiah(v.discountValue)}`}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Min. belanja {formatRupiah(v.minOrderAmount)}
                    {v.maxDiscountAmount
                      ? ` • Maks. ${formatRupiah(v.maxDiscountAmount)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyVoucher(v.code)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-xs font-semibold transition-colors shrink-0"
                >
                  {copiedCode === v.code ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Salin Kode
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Full-Width Store Info & Map Section */}
        <section
          id="info-desktop"
          className="w-full px-6 xl:px-10 py-10 border-t border-sand grid grid-cols-12 gap-8 items-stretch"
        >
          <div className="col-span-5 bg-white rounded-2xl border border-sand p-6 shadow-card flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h2 className="font-serif text-2xl font-bold text-ink">
                Kunjungi {catalog.settings.cafeName}
              </h2>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-caramel shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">Alamat</p>
                  <p className="text-sm text-ink mt-0.5">{catalog.settings.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-caramel shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">Jam Buka</p>
                  <p className="text-sm text-ink mt-0.5">{catalog.settings.openingHours}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-caramel shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase text-ink-muted">WhatsApp Kasir</p>
                  <p className="text-sm text-ink mt-0.5">+{catalog.settings.whatsappNumber}</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-ink-muted pt-4 border-t border-sand">
              &copy; {new Date().getFullYear()} {catalog.settings.cafeName}. All rights reserved.
            </p>
          </div>

          <div className="col-span-7 rounded-2xl overflow-hidden border border-sand shadow-card min-h-[280px] bg-white">
            {toSafeMapEmbedUrl(catalog.settings.mapsEmbedUrl, catalog.settings.address) && (
              <iframe
                src={toSafeMapEmbedUrl(catalog.settings.mapsEmbedUrl, catalog.settings.address)}
                className="w-full h-full border-0 min-h-[280px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Peta Lokasi Kafe"
              />
            )}
          </div>
        </section>
      </main>

      {/* Modals & Drawers */}
      <VariantModal
        product={modalProduct}
        categoryName={
          modalProduct ? categoryNameMap.get(modalProduct.categoryId) ?? "Menu" : ""
        }
        onClose={() => setModalProduct(null)}
        onAddToCart={addToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        boundTable={boundTable}
        onReleaseTableLock={() => {
          sessionStorage.removeItem("bb_bound_table");
          setBoundTable(null);
        }}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={(key) => setCart((prev) => prev.filter((i) => i.cartKey !== key))}
        onClearCart={() => setCart([])}
        settings={catalog.settings}
        onOrderSuccess={() => {}}
      />
    </div>
  );
}

