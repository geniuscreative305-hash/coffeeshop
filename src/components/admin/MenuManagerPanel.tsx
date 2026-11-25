"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { ImageDropzone } from "@/components/ui/ImageDropzone";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import { formatRupiah } from "@/lib/format";

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  iconName: string;
  sortOrder: number;
  isActive: boolean;
}

interface VariantRow {
  groupName: string;
  optionName: string;
  additionalPrice: number;
  isRequired: boolean;
}

interface ProductRow {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  discountPrice: number | null;
  imageUrl: string;
  badgeLabel: string | null;
  isLimitedStock: boolean;
  dailyQuota: number;
  remainingStock: number;
  isAvailable: boolean;
  variants: VariantRow[];
}

export function MenuManagerPanel() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Category quick form
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("Coffee");

  // Product modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    categoryId: 0,
    name: "",
    description: "",
    price: 30000,
    discountPrice: "",
    imageUrl: "",
    badgeLabel: "",
    isLimitedStock: false,
    dailyQuota: 20,
    remainingStock: 20,
    isAvailable: true,
    variants: [] as VariantRow[],
  });

  // Confirm modals
  const [confirmReset, setConfirmReset] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch("/api/admin/categories"),
        fetch("/api/admin/products"),
      ]);
      const cData = await cRes.json();
      const pData = await pRes.json();
      setCategories(cData.categories || []);
      setProducts(pData.products || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      categoryId: categories[0]?.id || 0,
      name: "",
      description: "",
      price: 30000,
      discountPrice: "",
      imageUrl: "",
      badgeLabel: "",
      isLimitedStock: false,
      dailyQuota: 20,
      remainingStock: 20,
      isAvailable: true,
      variants: [],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: ProductRow) => {
    setEditingId(p.id);
    setForm({
      categoryId: p.categoryId,
      name: p.name,
      description: p.description,
      price: p.price,
      discountPrice: p.discountPrice !== null ? String(p.discountPrice) : "",
      imageUrl: p.imageUrl,
      badgeLabel: p.badgeLabel || "",
      isLimitedStock: p.isLimitedStock,
      dailyQuota: p.dailyQuota,
      remainingStock: p.remainingStock,
      isAvailable: p.isAvailable,
      variants: p.variants.map((v) => ({
        groupName: v.groupName,
        optionName: v.optionName,
        additionalPrice: v.additionalPrice,
        isRequired: v.isRequired,
      })),
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imageUrl) {
      showToast("Silakan unggah foto produk (1:1) terlebih dahulu.", "error");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal menyimpan produk.", "error");
        return;
      }

      showToast(editingId ? "Produk diperbarui." : "Produk ditambahkan.", "success");
      setIsModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleResetAllStock = async () => {
    const res = await fetch("/api/admin/products/reset-stock", { method: "POST" });
    const data = await res.json();
    setConfirmReset(false);
    if (res.ok) {
      showToast(`Stok harian untuk ${data.count} produk terbatas berhasil direset!`, "success");
      loadData();
    } else {
      showToast(data.error || "Gagal mereset stok.", "error");
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/products/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok) {
      showToast("Produk dihapus.", "success");
      loadData();
    } else {
      showToast("Gagal menghapus produk.", "error");
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCatName.trim(),
        iconName: newCatIcon,
        sortOrder: categories.length + 1,
      }),
    });
    if (res.ok) {
      setNewCatName("");
      showToast("Kategori baru ditambahkan.", "success");
      loadData();
    }
  };

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-sand p-4 shadow-card">
        <div>
          <h2 className="font-serif text-xl font-bold text-ink">Manajemen Menu &amp; Kuota</h2>
          <p className="text-xs text-ink-muted">
            Upload foto langsung dari perangkat (auto center-crop 1:1) &amp; atur varian menu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-espresso text-xs font-bold hover:bg-amber-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Semua Stok Harian
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk Menu
          </button>
        </div>
      </div>

      {/* Categories Strip */}
      <div className="bg-white rounded-2xl border border-sand p-4 shadow-card space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Kategori Menu ({categories.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="px-3 py-1.5 rounded-full bg-cream border border-sand text-xs font-semibold text-ink"
            >
              {c.name}
            </span>
          ))}
        </div>
        <form onSubmit={handleCreateCategory} className="flex flex-wrap gap-2 pt-2 border-t border-sand">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Nama kategori baru..."
            className="px-3 py-2 rounded-xl border border-sand text-xs focus:outline-none focus:border-espresso"
          />
          <select
            value={newCatIcon}
            onChange={(e) => setNewCatIcon(e.target.value)}
            className="px-3 py-2 rounded-xl border border-sand text-xs bg-white focus:outline-none focus:border-espresso"
          >
            <option value="Coffee">Coffee</option>
            <option value="CupSoda">Non-Coffee</option>
            <option value="Croissant">Pastry</option>
            <option value="Sandwich">Sandwich</option>
            <option value="CakeSlice">Dessert</option>
            <option value="EggFried">Breakfast</option>
          </select>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-caramel text-white text-xs font-semibold hover:bg-espresso transition-colors"
          >
            + Tambah Kategori
          </button>
        </form>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="p-12 text-center text-ink-muted text-sm">Memuat daftar menu...</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-sand shadow-card overflow-hidden flex flex-col"
            >
              <div className="relative aspect-square bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                {p.isLimitedStock && (
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-amber-100 text-espresso text-[10px] font-bold border border-amber-300">
                    Stok: {p.remainingStock} / {p.dailyQuota}
                  </span>
                )}
                {!p.isAvailable && (
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                    Nonaktif
                  </span>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-caramel">
                    {catMap.get(p.categoryId) || "Menu"}
                  </span>
                  <h4 className="font-serif text-base font-bold text-ink">{p.name}</h4>
                  <p className="text-sm font-bold text-espresso mt-1">
                    {formatRupiah(p.discountPrice ?? p.price)}
                    {p.discountPrice && (
                      <span className="ml-2 text-xs line-through text-ink-muted font-normal">
                        {formatRupiah(p.price)}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-muted mt-1">
                    {p.variants.length} opsi varian
                  </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-sand">
                  <button
                    type="button"
                    onClick={() => openEditModal(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-cream hover:bg-sand/60 text-ink text-xs font-semibold transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(p)}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors"
                    aria-label="Hapus produk"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-sand shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-sand flex items-center justify-between bg-cream/60">
              <h3 className="font-serif text-lg font-bold text-ink">
                {editingId ? "Edit Produk Menu" : "Tambah Produk Menu Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full bg-white border border-sand text-ink-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-5">
              <ImageDropzone
                aspectRatio="1:1"
                folder="products"
                label="Foto Produk Menu"
                value={form.imageUrl}
                onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">
                    Nama Produk
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">
                    Kategori
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categoryId: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">
                    Harga Normal (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">
                    Harga Diskon (Opsional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.discountPrice}
                    onChange={(e) => setForm((f) => ({ ...f, discountPrice: e.target.value }))}
                    placeholder="Kosongkan jika tidak diskon"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">
                  Deskripsi Menu
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-sand text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">
                    Badge Label (Opsional)
                  </label>
                  <input
                    type="text"
                    value={form.badgeLabel}
                    onChange={(e) => setForm((f) => ({ ...f, badgeLabel: e.target.value }))}
                    placeholder="Contoh: Bestseller, Signature"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                  />
                </div>

                <label className="flex items-center gap-2.5 pt-4 cursor-pointer text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.isAvailable}
                    onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                    className="w-4 h-4 accent-espresso"
                  />
                  <span>Menu Aktif / Tersedia</span>
                </label>
              </div>

              {/* Limited Stock Controls */}
              <div className="p-4 rounded-2xl bg-cream/60 border border-sand space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-ink">
                  <input
                    type="checkbox"
                    checked={form.isLimitedStock}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isLimitedStock: e.target.checked }))
                    }
                    className="w-4 h-4 accent-espresso"
                  />
                  <span>Aktifkan Kuota Stok Harian Terbatas</span>
                </label>

                {form.isLimitedStock && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">
                        Kuota Harian
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form.dailyQuota}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, dailyQuota: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-sand bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">
                        Sisa Stok Saat Ini
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form.remainingStock}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, remainingStock: Number(e.target.value) }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-sand bg-white text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Variants Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Varian &amp; Add-On
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        variants: [
                          ...f.variants,
                          { groupName: "Suhu", optionName: "Ice", additionalPrice: 0, isRequired: true },
                        ],
                      }))
                    }
                    className="text-xs font-semibold text-espresso hover:underline"
                  >
                    + Tambah Opsi Varian
                  </button>
                </div>

                {form.variants.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Grup (misal: Suhu)"
                      value={v.groupName}
                      onChange={(e) => {
                        const next = [...form.variants];
                        next[idx].groupName = e.target.value;
                        setForm((f) => ({ ...f, variants: next }));
                      }}
                      className="col-span-3 px-2.5 py-2 rounded-lg border border-sand text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Opsi (misal: Ice)"
                      value={v.optionName}
                      onChange={(e) => {
                        const next = [...form.variants];
                        next[idx].optionName = e.target.value;
                        setForm((f) => ({ ...f, variants: next }));
                      }}
                      className="col-span-4 px-2.5 py-2 rounded-lg border border-sand text-xs"
                    />
                    <input
                      type="number"
                      placeholder="+Harga"
                      value={v.additionalPrice}
                      onChange={(e) => {
                        const next = [...form.variants];
                        next[idx].additionalPrice = Number(e.target.value);
                        setForm((f) => ({ ...f, variants: next }));
                      }}
                      className="col-span-2 px-2.5 py-2 rounded-lg border border-sand text-xs"
                    />
                    <label className="col-span-2 flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={v.isRequired}
                        onChange={(e) => {
                          const next = [...form.variants];
                          next[idx].isRequired = e.target.checked;
                          setForm((f) => ({ ...f, variants: next }));
                        }}
                      />
                      Wajib
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-1 text-rose-600 flex justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-sand flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-sand text-sm font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmReset}
        title="Reset Semua Stok Harian?"
        description="Seluruh produk dengan kuota harian terbatas akan dikembalikan ke jumlah daily_quota awalnya dan dicatat ke Audit Log."
        confirmLabel="Ya, Reset Sekarang"
        onConfirm={handleResetAllStock}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Produk Menu?"
        description={`Produk "${deleteTarget?.name}" beserta file fotonya akan dihapus secara permanen.`}
        confirmLabel="Hapus Produk"
        danger
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

