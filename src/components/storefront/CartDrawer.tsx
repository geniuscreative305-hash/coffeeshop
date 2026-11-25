"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Plus,
  Minus,
  Tag,
  CheckCircle2,
  MessageCircle,
  MapPin,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import type { CartItem } from "@/lib/types";
import type { CatalogStoreSettings } from "@/lib/catalog";
import { formatRupiah, formatWibDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";

interface CreatedOrderReceipt {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  tableNumber: string | null;
  paymentMethod: string;
  subtotal: number;
  voucherCode: string | null;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  itemsJson: {
    name: string;
    qty: number;
    selected_variants: { group_name: string; option_name: string }[];
    item_total: number;
  }[];
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  boundTable: string | null;
  onReleaseTableLock: () => void;
  onUpdateQty: (cartKey: string, delta: number) => void;
  onRemoveItem: (cartKey: string) => void;
  onClearCart: () => void;
  settings: CatalogStoreSettings;
  onOrderSuccess: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  boundTable,
  onReleaseTableLock,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  settings,
  onOrderSuccess,
}: CartDrawerProps) {
  const { showToast } = useToast();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<"Dine-In" | "Pickup" | "Delivery">(
    boundTable ? "Dine-In" : "Pickup"
  );
  const [manualTable, setManualTable] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "QRIS" | "Transfer">("QRIS");
  const [notes, setNotes] = useState("");

  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<CreatedOrderReceipt | null>(null);

  useEffect(() => {
    if (boundTable) {
      setOrderType("Dine-In");
    }
  }, [boundTable]);

  const subtotal = items.reduce((sum, item) => sum + item.unitTotal * item.qty, 0);
  const discountAmount = appliedVoucher ? Math.min(appliedVoucher.discountAmount, subtotal) : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const handleApplyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;

    setIsValidatingVoucher(true);
    try {
      const res = await fetch("/api/vouchers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAppliedVoucher(null);
        showToast(data.error || "Voucher tidak valid.", "error");
        return;
      }
      setAppliedVoucher({ code: data.code, discountAmount: data.discountAmount });
      showToast(`Voucher ${data.code} berhasil diterapkan!`, "success");
    } catch {
      showToast("Gagal memvalidasi voucher.", "error");
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const effectiveTable =
      orderType === "Dine-In" ? boundTable || manualTable.trim() : null;

    if (orderType === "Dine-In" && !effectiveTable) {
      showToast("Silakan masukkan nomor meja untuk Dine-In.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          order_type: orderType,
          table_number: effectiveTable,
          payment_method: paymentMethod,
          voucher_code: appliedVoucher?.code || null,
          notes: notes.trim() || null,
          items: items.map((i) => ({
            product_id: i.productId,
            qty: i.qty,
            selected_variants: i.selectedVariants,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal membuat pesanan.", "error");
        return;
      }

      setReceipt(data.order);
      onClearCart();
      setAppliedVoucher(null);
      setVoucherInput("");
      onOrderSuccess();
      showToast(`Pesanan ${data.order.orderCode} berhasil dibuat!`, "success");
    } catch {
      showToast("Terjadi gangguan jaringan saat mengirim pesanan.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildWhatsappUrl = (ord: CreatedOrderReceipt) => {
    const cleanPhone = settings.whatsappNumber.replace(/[^0-9]/g, "");
    const itemLines = ord.itemsJson
      .map((i) => {
        const vars =
          i.selected_variants?.length > 0
            ? ` (${i.selected_variants.map((v) => v.option_name).join(", ")})`
            : "";
        return `• ${i.qty}x ${i.name}${vars} = ${formatRupiah(i.item_total)}`;
      })
      .join("\n");

    const text = [
      `*PESANAN BARU — ${settings.cafeName}*`,
      `Kode Order: *${ord.orderCode}*`,
      `Nama: ${ord.customerName}`,
      `Tipe: ${ord.orderType}${ord.tableNumber ? ` (Meja ${ord.tableNumber})` : ""}`,
      `Metode Bayar: ${ord.paymentMethod}`,
      ``,
      `*Detail Pesanan:*`,
      itemLines,
      ``,
      `Subtotal: ${formatRupiah(ord.subtotal)}`,
      ord.discountAmount > 0
        ? `Diskon (${ord.voucherCode}): -${formatRupiah(ord.discountAmount)}`
        : null,
      `*Total Bayar: ${formatRupiah(ord.totalAmount)}*`,
      ord.notes ? `Catatan: ${ord.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-ink/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-sand">
        {/* Header */}
        <div className="px-5 py-4 border-b border-sand flex items-center justify-between bg-cream/70">
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">
              {receipt ? "Konfirmasi Pesanan" : "Keranjang Saya"}
            </h2>
            {!receipt && (
              <p className="text-xs text-ink-muted">
                {items.reduce((s, i) => s + i.qty, 0)} item dipilih
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              onClose();
            }}
            className="p-2 rounded-full bg-white border border-sand text-ink-muted hover:text-ink transition-colors"
            aria-label="Tutup keranjang"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt View */}
        {receipt ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1.5">
              <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Pesanan Diterima
              </p>
              <p className="font-mono text-lg font-bold text-ink">{receipt.orderCode}</p>
              <p className="text-xs text-ink-muted">{formatWibDateTime(receipt.createdAt)}</p>
            </div>

            <div className="rounded-2xl border border-sand p-4 space-y-3 bg-cream/40 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Pelanggan</span>
                <span className="font-semibold text-ink">{receipt.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Tipe Pesanan</span>
                <span className="font-semibold text-ink">
                  {receipt.orderType}
                  {receipt.tableNumber ? ` • Meja ${receipt.tableNumber}` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Pembayaran</span>
                <span className="font-semibold text-ink">{receipt.paymentMethod}</span>
              </div>

              <div className="border-t border-sand pt-3 space-y-2">
                {receipt.itemsJson.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-ink">
                        {item.qty}x {item.name}
                      </p>
                      {item.selected_variants?.length > 0 && (
                        <p className="text-ink-muted">
                          {item.selected_variants.map((v) => v.option_name).join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-ink shrink-0">
                      {formatRupiah(item.item_total)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-sand pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span>{formatRupiah(receipt.subtotal)}</span>
                </div>
                {receipt.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Diskon ({receipt.voucherCode})</span>
                    <span>-{formatRupiah(receipt.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-espresso pt-1">
                  <span>Total Bayar</span>
                  <span>{formatRupiah(receipt.totalAmount)}</span>
                </div>
              </div>
            </div>

            <a
              href={buildWhatsappUrl(receipt)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Kirim Ringkasan ke WhatsApp Kasir
            </a>

            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                onClose();
              }}
              className="w-full px-5 py-3 rounded-xl border border-sand text-sm font-semibold text-ink hover:bg-cream transition-colors"
            >
              Pesan Menu Lainnya
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-cream border border-sand flex items-center justify-center text-caramel mb-4">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-lg font-bold text-ink">Keranjang Masih Kosong</h3>
            <p className="text-sm text-ink-muted mt-1 max-w-xs">
              Pilih kopi spesialti atau pastry favorit Anda untuk mulai memesan.
            </p>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Cart Items */}
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.cartKey}
                    className="flex gap-3 p-3 rounded-2xl border border-sand bg-cream/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover border border-sand shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-ink leading-tight">{item.name}</h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.cartKey)}
                          className="text-ink-muted hover:text-rose-600 transition-colors p-0.5"
                          aria-label="Hapus item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.selectedVariants.length > 0 && (
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {item.selectedVariants.map((v) => v.option_name).join(" • ")}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-espresso">
                          {formatRupiah(item.unitTotal * item.qty)}
                        </span>
                        <div className="flex items-center gap-1.5 border border-sand rounded-lg bg-white px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.cartKey, -1)}
                            className="w-6 h-6 flex items-center justify-center text-ink hover:bg-cream rounded"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.cartKey, 1)}
                            className="w-6 h-6 flex items-center justify-center text-ink hover:bg-cream rounded"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Voucher Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Kode Voucher
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: NGOPIPAGI"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-sand bg-white text-sm uppercase focus:outline-none focus:border-espresso"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyVoucher}
                    disabled={isValidatingVoucher || !voucherInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-caramel hover:bg-espresso text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isValidatingVoucher ? "..." : "Terapkan"}
                  </button>
                </div>
                {appliedVoucher && (
                  <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl border border-emerald-200">
                    <span>
                      Voucher <strong>{appliedVoucher.code}</strong> aktif (-
                      {formatRupiah(discountAmount)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppliedVoucher(null)}
                      className="underline font-semibold"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Order Type & Table Binding */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Tipe Pesanan
                  </label>
                  {boundTable && (
                    <button
                      type="button"
                      onClick={() => {
                        onReleaseTableLock();
                        setOrderType("Pickup");
                      }}
                      className="text-[11px] font-semibold text-caramel underline hover:text-espresso"
                    >
                      Ganti ke Takeaway/Pickup
                    </button>
                  )}
                </div>

                {boundTable ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-espresso/5 border border-espresso/20 text-sm">
                    <MapPin className="w-4 h-4 text-espresso shrink-0" />
                    <div>
                      <p className="font-bold text-espresso">Dine-In • Meja {boundTable}</p>
                      <p className="text-[11px] text-ink-muted">
                        Terdeteksi otomatis dari QR Meja Anda.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {(["Dine-In", "Pickup", "Delivery"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setOrderType(t)}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                            orderType === t
                              ? "bg-espresso text-white border-espresso"
                              : "bg-white text-ink border-sand hover:border-caramel"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {orderType === "Dine-In" && (
                      <input
                        type="text"
                        required
                        value={manualTable}
                        onChange={(e) => setManualTable(e.target.value)}
                        placeholder="Nomor Meja (contoh: 01)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-sand bg-white text-sm focus:outline-none focus:border-espresso"
                      />
                    )}
                  </>
                )}
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Data Pemesan & Pembayaran
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand bg-white text-sm focus:outline-none focus:border-espresso"
                />
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Nomor WhatsApp (contoh: 08123456789)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand bg-white text-sm focus:outline-none focus:border-espresso"
                />
                <div className="grid grid-cols-3 gap-2">
                  {(["QRIS", "Cash", "Transfer"] as const).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setPaymentMethod(pm)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        paymentMethod === pm
                          ? "bg-espresso text-white border-espresso"
                          : "bg-white text-ink border-sand hover:border-caramel"
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan (opsional, misal: es dipisah)"
                  className="w-full px-3.5 py-2 rounded-xl border border-sand bg-white text-sm focus:outline-none focus:border-espresso resize-none"
                />
              </div>
            </div>

            {/* Footer Totals & Submit */}
            <div className="p-5 border-t border-sand bg-cream/60 space-y-3 pb-safe">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Diskon Voucher</span>
                    <span>-{formatRupiah(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-espresso pt-1">
                  <span>Total Pembayaran</span>
                  <span>{formatRupiah(totalAmount)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !settings.isOpenNow}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Pesanan...</span>
                  </>
                ) : !settings.isOpenNow ? (
                  <span>Toko Sedang Tutup</span>
                ) : (
                  <span>Buat Pesanan Sekarang</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

