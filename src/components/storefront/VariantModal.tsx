"use client";

import React, { useMemo, useState, useEffect } from "react";
import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog";
import type { SelectedVariant } from "@/lib/types";
import { formatRupiah } from "@/lib/format";

interface VariantModalProps {
  product: CatalogProduct | null;
  categoryName: string;
  onClose: () => void;
  onAddToCart: (
    product: CatalogProduct,
    categoryName: string,
    selectedVariants: SelectedVariant[],
    qty: number
  ) => void;
}

export function VariantModal({
  product,
  categoryName,
  onClose,
  onAddToCart,
}: VariantModalProps) {
  const [qty, setQty] = useState(1);
  const [selectedMap, setSelectedMap] = useState<Record<string, CatalogVariant[]>>({});

  // Group variants by groupName
  const groupedVariants = useMemo(() => {
    if (!product) return [];
    const groups = new Map<string, { isRequired: boolean; options: CatalogVariant[] }>();
    for (const v of product.variants) {
      const existing = groups.get(v.groupName) ?? {
        isRequired: v.isRequired,
        options: [],
      };
      existing.options.push(v);
      if (v.isRequired) existing.isRequired = true;
      groups.set(v.groupName, existing);
    }
    return Array.from(groups.entries()).map(([groupName, data]) => ({
      groupName,
      isRequired: data.isRequired,
      options: data.options,
    }));
  }, [product]);

  // Pre-select first option for required groups
  useEffect(() => {
    if (!product) return;
    setQty(1);
    const initial: Record<string, CatalogVariant[]> = {};
    for (const g of groupedVariants) {
      if (g.isRequired && g.options.length > 0) {
        initial[g.groupName] = [g.options[0]];
      } else {
        initial[g.groupName] = [];
      }
    }
    setSelectedMap(initial);
  }, [product, groupedVariants]);

  if (!product) return null;

  const basePrice = product.discountPrice ?? product.price;
  const selectedVariantsList: SelectedVariant[] = Object.values(selectedMap)
    .flat()
    .map((v) => ({
      group_name: v.groupName,
      option_name: v.optionName,
      additional_price: v.additionalPrice,
    }));

  const extraPrice = selectedVariantsList.reduce((acc, v) => acc + v.additional_price, 0);
  const unitPrice = basePrice + extraPrice;
  const maxQty = product.isLimitedStock ? Math.max(1, product.remainingStock) : 99;

  const toggleOption = (groupName: string, isRequired: boolean, option: CatalogVariant) => {
    setSelectedMap((prev) => {
      const current = prev[groupName] ?? [];
      if (isRequired) {
        // Single-select radio behavior
        return { ...prev, [groupName]: [option] };
      }
      // Multi-select checkbox behavior for optional add-ons
      const exists = current.some((o) => o.id === option.id);
      if (exists) {
        return { ...prev, [groupName]: current.filter((o) => o.id !== option.id) };
      }
      return { ...prev, [groupName]: [...current, option] };
    });
  };

  const handleConfirm = () => {
    onAddToCart(product, categoryName, selectedVariantsList, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink/55 backdrop-blur-xs p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-sand shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
      >
        <div className="relative flex items-center gap-4 p-4 sm:p-5 border-b border-sand bg-cream/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-20 h-20 rounded-2xl object-cover border border-sand shrink-0"
          />
          <div className="flex-1 min-w-0 pr-6">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-caramel">
              {categoryName}
            </span>
            <h3 className="font-serif text-lg font-bold text-ink leading-snug">
              {product.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-bold text-espresso">
                {formatRupiah(basePrice)}
              </span>
              {product.discountPrice && (
                <span className="text-xs line-through text-ink-muted">
                  {formatRupiah(product.price)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white border border-sand text-ink-muted hover:text-ink transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {product.description && (
            <p className="text-sm text-ink-muted leading-relaxed">{product.description}</p>
          )}

          {groupedVariants.map((group) => (
            <div key={group.groupName} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-ink">{group.groupName}</h4>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    group.isRequired
                      ? "bg-espresso/10 text-espresso"
                      : "bg-cream text-ink-muted border border-sand"
                  }`}
                >
                  {group.isRequired ? "Wajib pilih 1" : "Opsional"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.options.map((opt) => {
                  const isSelected = (selectedMap[group.groupName] ?? []).some(
                    (o) => o.id === opt.id
                  );
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(group.groupName, group.isRequired, opt)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-sm transition-all ${
                        isSelected
                          ? "border-espresso bg-espresso/5 text-espresso font-semibold shadow-xs"
                          : "border-sand bg-white text-ink hover:border-caramel"
                      }`}
                    >
                      <span>{opt.optionName}</span>
                      <span className="text-xs text-ink-muted ml-2">
                        {opt.additionalPrice > 0 ? `+${formatRupiah(opt.additionalPrice)}` : "Gratis"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-5 border-t border-sand bg-white flex items-center justify-between gap-4 pb-safe">
          <div className="flex items-center gap-2 border border-sand rounded-xl p-1 bg-cream/60">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink hover:bg-white transition-colors"
              aria-label="Kurangi jumlah"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-7 text-center text-sm font-bold text-ink">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink hover:bg-white transition-colors"
              aria-label="Tambah jumlah"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Tambah • {formatRupiah(unitPrice * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

