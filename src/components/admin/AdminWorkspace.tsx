"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  LayoutDashboard,
  ClipboardList,
  Coffee,
  TicketPercent,
  History,
  Settings,
  LogOut,
  Printer,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { formatRupiah, formatWibDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/ToastProvider";
import { ImageDropzone } from "@/components/ui/ImageDropzone";
import {
  PrintableDocument,
  type PaperSize,
  type PrintablePayload,
} from "@/components/ui/PrintableDocument";
import { MenuManagerPanel } from "./MenuManagerPanel";
import { QrTablePanel } from "./QrTablePanel";
import type { OrderItemJson } from "@/db/schema";

type AdminTab = "dashboard" | "orders" | "menu" | "promo-qr" | "audit" | "settings";

interface OrderRow {
  id: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  orderType: "Dine-In" | "Pickup" | "Delivery";
  tableNumber: string | null;
  itemsJson: OrderItemJson[];
  subtotal: number;
  voucherCode: string | null;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: "Cash" | "QRIS" | "Transfer";
  orderStatus: "Pending" | "Brewing" | "Ready" | "Completed" | "Cancelled";
  notes: string | null;
  createdAt: string;
}

interface DashboardData {
  period: { start: string; end: string };
  summary: {
    grossRevenue: number;
    totalDiscount: number;
    netRevenue: number;
    completedCount: number;
    activeCount: number;
    totalOrders: number;
  };
  byCategory: { category: string; total: number }[];
  byPayment: { method: string; total: number; count: number }[];
  orders: OrderRow[];
}

interface PromoRow {
  id: number;
  title: string;
  subtitle: string;
  discountText: string;
  bannerImageUrl: string;
  isActive: boolean;
}

interface VoucherRow {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  validUntil: string;
  isActive: boolean;
}

interface AuditRow {
  id: number;
  actorName: string;
  actionType: string;
  targetEntity: string;
  detailsJson: { before?: unknown; after?: unknown; note?: string };
  createdAt: string;
}

export function AdminWorkspace({
  adminName,
  adminEmail,
}: {
  adminName: string;
  adminEmail: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  // Print isolation state
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [printableData, setPrintableData] = useState<PrintablePayload>(null);

  // Dashboard & Report
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");

  // Live Orders
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Promos & Vouchers
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [promoForm, setPromoForm] = useState({
    title: "",
    subtitle: "",
    discountText: "",
    bannerImageUrl: "",
  });
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [voucherForm, setVoucherForm] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: 10,
    minOrderAmount: 25000,
    maxDiscountAmount: "",
    usageLimit: "",
  });

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");

  // Store Settings
  const [settings, setSettings] = useState({
    cafeName: "Brew & Bliss Coffee House",
    tagline: "",
    address: "",
    mapsEmbedUrl: "",
    openingHours: "",
    whatsappNumber: "",
    isOpenNow: true,
  });

  const loadDashboard = useCallback(async () => {
    const params = new URLSearchParams();
    if (reportStart) params.set("start", reportStart);
    if (reportEnd) params.set("end", reportEnd);
    const res = await fetch(`/api/admin/dashboard?${params.toString()}`);
    if (res.ok) {
      const data: DashboardData = await res.json();
      setDashboard(data);
      if (!reportStart) setReportStart(data.period.start);
      if (!reportEnd) setReportEnd(data.period.end);
    }
  }, [reportStart, reportEnd]);

  const loadOrders = useCallback(async () => {
    const q = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
    const res = await fetch(`/api/admin/orders${q}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders || []);
    }
  }, [statusFilter]);

  const loadPromosAndVouchers = useCallback(async () => {
    const [pRes, vRes] = await Promise.all([
      fetch("/api/admin/promos"),
      fetch("/api/admin/vouchers"),
    ]);
    if (pRes.ok) {
      const p = await pRes.json();
      setPromos(p.promos || []);
    }
    if (vRes.ok) {
      const v = await vRes.json();
      setVouchers(v.vouchers || []);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(auditPage),
      limit: "12",
      actionType: auditActionFilter,
    });
    const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setAuditLogs(data.logs || []);
      setAuditTotalPages(data.pagination?.totalPages || 1);
    }
  }, [auditPage, auditActionFilter]);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab === "dashboard") loadDashboard();
    if (activeTab === "orders") loadOrders();
    if (activeTab === "promo-qr") loadPromosAndVouchers();
    if (activeTab === "audit") loadAuditLogs();
  }, [activeTab, loadDashboard, loadOrders, loadPromosAndVouchers, loadAuditLogs]);

  // Optimistic order status update
  const handleOrderStatusChange = async (
    order: OrderRow,
    newStatus: OrderRow["orderStatus"]
  ) => {
    const prevOrders = [...orders];
    setOrders((curr) =>
      curr.map((o) => (o.id === order.id ? { ...o, orderStatus: newStatus } : o))
    );

    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderStatus: newStatus }),
    });

    if (!res.ok) {
      setOrders(prevOrders);
      showToast("Gagal memperbarui status pesanan.", "error");
      return;
    }

    showToast(
      newStatus === "Cancelled"
        ? `Pesanan ${order.orderCode} dibatalkan & stok terbatas dikembalikan.`
        : `Status ${order.orderCode} -> ${newStatus}`,
      "success"
    );
  };

  // Trigger isolated print
  const triggerPrint = (size: PaperSize, payload: PrintablePayload) => {
    setPaperSize(size);
    setPrintableData(payload);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handlePrintReport = (size: PaperSize) => {
    if (!dashboard) return;
    triggerPrint(size, {
      type: "report",
      cafeName: settings.cafeName,
      cafeAddress: settings.address,
      periodLabel: `${dashboard.period.start} s/d ${dashboard.period.end}`,
      printedAt: formatWibDateTime(new Date()),
      summary: dashboard.summary,
      byCategory: dashboard.byCategory,
      byPayment: dashboard.byPayment,
      orders: dashboard.orders.map((o) => ({
        orderCode: o.orderCode,
        createdAt: o.createdAt,
        customerName: o.customerName,
        orderType: o.orderType,
        tableNumber: o.tableNumber,
        paymentMethod: o.paymentMethod,
        orderStatus: o.orderStatus,
        totalAmount: o.totalAmount,
      })),
    });
  };

  const handlePrintInvoice = (order: OrderRow, size: PaperSize) => {
    triggerPrint(size, {
      type: "invoice",
      cafeName: settings.cafeName,
      cafeAddress: settings.address,
      orderCode: order.orderCode,
      createdAt: order.createdAt,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderType: order.orderType,
      tableNumber: order.tableNumber,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      items: order.itemsJson,
      subtotal: order.subtotal,
      voucherCode: order.voucherCode,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      notes: order.notes,
    });
  };

  const handleExportXlsx = () => {
    if (!dashboard) return;
    const wb = XLSX.utils.book_new();

    const txRows = dashboard.orders.map((o) => ({
      "Kode Order": o.orderCode,
      Waktu: formatWibDateTime(o.createdAt),
      Pelanggan: o.customerName,
      Telepon: o.customerPhone,
      Tipe: o.orderType,
      Meja: o.tableNumber || "-",
      Metode: o.paymentMethod,
      Status: o.orderStatus,
      Subtotal: o.subtotal,
      Diskon: o.discountAmount,
      Total: o.totalAmount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows), "Transaksi");

    const summaryRows = [
      { Metrik: "Omzet Kotor", Nilai: dashboard.summary.grossRevenue },
      { Metrik: "Total Diskon", Nilai: dashboard.summary.totalDiscount },
      { Metrik: "Omzet Bersih", Nilai: dashboard.summary.netRevenue },
      { Metrik: "Transaksi Sukses", Nilai: dashboard.summary.completedCount },
      ...dashboard.byCategory.map((c) => ({
        Metrik: `Kategori: ${c.category}`,
        Nilai: c.total,
      })),
      ...dashboard.byPayment.map((p) => ({
        Metrik: `Pembayaran: ${p.method} (${p.count}x)`,
        Nilai: p.total,
      })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Closing Shift");

    XLSX.writeFile(wb, `Laporan-${dashboard.period.start}_${dashboard.period.end}.xlsx`);
    showToast("Laporan Excel (.xlsx) berhasil diunduh.", "success");
  };

  const handleExportCsv = () => {
    if (!dashboard) return;
    const headers = [
      "Kode Order",
      "Waktu",
      "Pelanggan",
      "Tipe",
      "Meja",
      "Metode",
      "Status",
      "Subtotal",
      "Diskon",
      "Total",
    ];
    const rows = dashboard.orders.map((o) => [
      o.orderCode,
      formatWibDateTime(o.createdAt),
      `"${o.customerName.replace(/"/g, '""')}"`,
      o.orderType,
      o.tableNumber || "-",
      o.paymentMethod,
      o.orderStatus,
      o.subtotal,
      o.discountAmount,
      o.totalAmount,
    ]);
    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan-${dashboard.period.start}_${dashboard.period.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Laporan CSV (UTF-8 BOM) berhasil diunduh.", "success");
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.bannerImageUrl) {
      showToast("Silakan unggah banner promo 16:9 terlebih dahulu.", "error");
      return;
    }
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promoForm),
    });
    if (res.ok) {
      setPromoForm({ title: "", subtitle: "", discountText: "", bannerImageUrl: "" });
      showToast("Banner promo ditambahkan.", "success");
      loadPromosAndVouchers();
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(voucherForm),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal menambah voucher.", "error");
      return;
    }
    setVoucherForm({
      code: "",
      discountType: "percentage",
      discountValue: 10,
      minOrderAmount: 25000,
      maxDiscountAmount: "",
      usageLimit: "",
    });
    showToast("Voucher baru disimpan.", "success");
    loadPromosAndVouchers();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      showToast("Pengaturan toko diperbarui.", "success");
    } else {
      showToast("Gagal menyimpan pengaturan.", "error");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard & Laporan", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "orders", label: "Live Order Board", icon: <ClipboardList className="w-4 h-4" /> },
    { id: "menu", label: "Menu, Stok & Varian", icon: <Coffee className="w-4 h-4" /> },
    { id: "promo-qr", label: "Promo, Voucher & QR", icon: <TicketPercent className="w-4 h-4" /> },
    { id: "audit", label: "Audit Log", icon: <History className="w-4 h-4" /> },
    { id: "settings", label: "Pengaturan Toko", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      <div className="min-h-screen min-h-[100dvh] w-full bg-cream flex flex-col lg:flex-row">
        {/* Fixed Left Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-espresso text-cream flex flex-col justify-between lg:sticky lg:top-0 lg:h-screen">
          <div>
            <div className="p-5 border-b border-white/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                Admin Console
              </p>
              <h1 className="font-serif text-lg font-bold text-white truncate">
                {settings.cafeName}
              </h1>
              <p className="text-xs text-cream/70 truncate mt-0.5">{adminName}</p>
            </div>

            <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === item.id
                      ? "bg-white text-espresso shadow-sm"
                      : "text-cream/85 hover:bg-white/10"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 border-t border-white/10 hidden lg:block space-y-2">
            <p className="text-[11px] text-cream/60 truncate">{adminEmail}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </aside>

        {/* Full-Width Right Workspace */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 xl:p-8 space-y-6">
          {/* 1. DASHBOARD & CLOSING SHIFT */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-sand p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Dashboard &amp; Closing Shift
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Ringkasan omzet, kategori, metode bayar, cetak PDF A4/A5, &amp; ekspor Excel/CSV.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={reportStart}
                    onChange={(e) => setReportStart(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-sand text-xs"
                  />
                  <span className="text-xs text-ink-muted">s/d</span>
                  <input
                    type="date"
                    value={reportEnd}
                    onChange={(e) => setReportEnd(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-sand text-xs"
                  />
                  <button
                    type="button"
                    onClick={loadDashboard}
                    className="p-2 rounded-xl bg-cream border border-sand text-espresso hover:bg-sand/50"
                    title="Muat ulang"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {dashboard && (
                <>
                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white rounded-2xl border border-sand p-4 shadow-card">
                      <p className="text-[11px] font-bold uppercase text-ink-muted">Omzet Kotor</p>
                      <p className="text-lg font-bold text-ink mt-1">
                        {formatRupiah(dashboard.summary.grossRevenue)}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-sand p-4 shadow-card">
                      <p className="text-[11px] font-bold uppercase text-ink-muted">Diskon Voucher</p>
                      <p className="text-lg font-bold text-rose-700 mt-1">
                        -{formatRupiah(dashboard.summary.totalDiscount)}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-sand p-4 shadow-card">
                      <p className="text-[11px] font-bold uppercase text-ink-muted">Omzet Bersih</p>
                      <p className="text-lg font-bold text-espresso mt-1">
                        {formatRupiah(dashboard.summary.netRevenue)}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-sand p-4 shadow-card">
                      <p className="text-[11px] font-bold uppercase text-ink-muted">Transaksi Sukses</p>
                      <p className="text-lg font-bold text-emerald-700 mt-1">
                        {dashboard.summary.completedCount}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl border border-sand p-4 shadow-card">
                      <p className="text-[11px] font-bold uppercase text-ink-muted">Pesanan Aktif</p>
                      <p className="text-lg font-bold text-caramel mt-1">
                        {dashboard.summary.activeCount}
                      </p>
                    </div>
                  </div>

                  {/* Export & Print Toolbar */}
                  <div className="bg-white rounded-2xl border border-sand p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportXlsx}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> Export .XLSX
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cream border border-sand hover:border-espresso text-ink text-xs font-semibold"
                      >
                        <FileText className="w-4 h-4" /> Export .CSV
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={paperSize}
                        onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                        className="px-3 py-2 rounded-xl border border-sand text-xs font-semibold bg-white"
                      >
                        <option value="A4">Kertas A4</option>
                        <option value="A5">Kertas A5</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handlePrintReport(paperSize)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-xs font-semibold"
                      >
                        <Printer className="w-4 h-4" /> Cetak Laporan ({paperSize})
                      </button>
                    </div>
                  </div>

                  {/* Breakdowns */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl border border-sand p-5 shadow-card space-y-3">
                      <h3 className="font-serif text-base font-bold text-ink">
                        Omzet Per Kategori Menu
                      </h3>
                      <div className="space-y-2 text-sm">
                        {dashboard.byCategory.length === 0 ? (
                          <p className="text-xs text-ink-muted">Belum ada transaksi.</p>
                        ) : (
                          dashboard.byCategory.map((c) => (
                            <div
                              key={c.category}
                              className="flex justify-between py-1.5 border-b border-sand/60"
                            >
                              <span>{c.category}</span>
                              <span className="font-bold text-espresso">
                                {formatRupiah(c.total)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-sand p-5 shadow-card space-y-3">
                      <h3 className="font-serif text-base font-bold text-ink">
                        Omzet Per Metode Pembayaran
                      </h3>
                      <div className="space-y-2 text-sm">
                        {dashboard.byPayment.length === 0 ? (
                          <p className="text-xs text-ink-muted">Belum ada transaksi.</p>
                        ) : (
                          dashboard.byPayment.map((p) => (
                            <div
                              key={p.method}
                              className="flex justify-between py-1.5 border-b border-sand/60"
                            >
                              <span>
                                {p.method} ({p.count}x)
                              </span>
                              <span className="font-bold text-espresso">
                                {formatRupiah(p.total)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2. LIVE ORDER BOARD */}
          {activeTab === "orders" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-sand p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">Live Order Board</h2>
                  <p className="text-xs text-ink-muted">
                    Ubah status pesanan secara instan. Pembatalan otomatis mengembalikan stok terbatas.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {["ALL", "Pending", "Brewing", "Ready", "Completed", "Cancelled"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        statusFilter === st
                          ? "bg-espresso text-white border-espresso"
                          : "bg-cream text-ink border-sand hover:border-caramel"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={loadOrders}
                    className="p-2 rounded-xl border border-sand bg-white text-espresso"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white rounded-2xl border border-sand p-4 shadow-card flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-espresso">
                            {ord.orderCode}
                          </span>
                          <p className="text-[11px] text-ink-muted">
                            {formatWibDateTime(ord.createdAt)}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-cream border border-sand text-[11px] font-bold text-ink">
                          {ord.orderType}
                          {ord.tableNumber ? ` #${ord.tableNumber}` : ""}
                        </span>
                      </div>

                      <div className="text-xs">
                        <p className="font-bold text-ink">
                          {ord.customerName} ({ord.customerPhone})
                        </p>
                        <p className="text-ink-muted">Bayar: {ord.paymentMethod}</p>
                      </div>

                      <div className="border-t border-sand pt-2 space-y-1 text-xs">
                        {ord.itemsJson.map((it, idx) => (
                          <div key={idx} className="flex justify-between gap-2">
                            <span>
                              {it.qty}x {it.name}
                            </span>
                            <span className="font-semibold">{formatRupiah(it.item_total)}</span>
                          </div>
                        ))}
                      </div>

                      {ord.notes && (
                        <p className="text-[11px] bg-amber-50 border border-amber-200 rounded-lg p-2 text-ink">
                          Catatan: {ord.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-sand space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-muted">Total</span>
                        <span className="text-base font-bold text-espresso">
                          {formatRupiah(ord.totalAmount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={ord.orderStatus}
                          onChange={(e) =>
                            handleOrderStatusChange(
                              ord,
                              e.target.value as OrderRow["orderStatus"]
                            )
                          }
                          className="flex-1 px-3 py-2 rounded-xl border border-sand bg-cream/60 text-xs font-bold text-ink"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Brewing">Brewing</option>
                          <option value="Ready">Ready</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handlePrintInvoice(ord, "A5")}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-espresso text-white text-xs font-semibold hover:bg-espresso-hover"
                          title="Cetak Struk A5"
                        >
                          <Printer className="w-3.5 h-3.5" /> Struk
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. MENU, STOK & VARIAN */}
          {activeTab === "menu" && <MenuManagerPanel />}

          {/* 4. PROMO, VOUCHER & QR MEJA */}
          {activeTab === "promo-qr" && (
            <div className="space-y-8">
              {/* Promo Banners */}
              <section className="space-y-4">
                <h2 className="font-serif text-xl font-bold text-ink">
                  Manajemen Banner Promo (16:9)
                </h2>
                <form
                  onSubmit={handleCreatePromo}
                  className="bg-white rounded-2xl border border-sand p-5 shadow-card space-y-4"
                >
                  <ImageDropzone
                    aspectRatio="16:9"
                    folder="promos"
                    label="Banner Promo"
                    value={promoForm.bannerImageUrl}
                    onChange={(url) => setPromoForm((f) => ({ ...f, bannerImageUrl: url }))}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Judul Promo"
                      value={promoForm.title}
                      onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))}
                      className="px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Subjudul"
                      value={promoForm.subtitle}
                      onChange={(e) => setPromoForm((f) => ({ ...f, subtitle: e.target.value }))}
                      className="px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Badge Diskon (misal: 20% OFF)"
                      value={promoForm.discountText}
                      onChange={(e) =>
                        setPromoForm((f) => ({ ...f, discountText: e.target.value }))
                      }
                      className="px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-espresso text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4" /> Tambah Banner Promo
                  </button>
                </form>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {promos.map((pr) => (
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
                      <div className="p-3.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-ink truncate">{pr.title}</p>
                          <p className="text-xs text-caramel font-semibold">{pr.discountText}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/admin/promos?id=${pr.id}`, { method: "DELETE" });
                            loadPromosAndVouchers();
                          }}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Vouchers */}
              <section className="space-y-4">
                <h2 className="font-serif text-xl font-bold text-ink">Kode Voucher Diskon</h2>
                <form
                  onSubmit={handleCreateVoucher}
                  className="bg-white rounded-2xl border border-sand p-5 shadow-card grid grid-cols-2 sm:grid-cols-6 gap-3 items-end"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-ink-muted mb-1">Kode</label>
                    <input
                      type="text"
                      required
                      value={voucherForm.code}
                      onChange={(e) =>
                        setVoucherForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                      }
                      placeholder="KODEPROMO"
                      className="w-full px-3 py-2 rounded-xl border border-sand text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-muted mb-1">Tipe</label>
                    <select
                      value={voucherForm.discountType}
                      onChange={(e) =>
                        setVoucherForm((f) => ({
                          ...f,
                          discountType: e.target.value as "percentage" | "fixed",
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-sand text-xs bg-white"
                    >
                      <option value="percentage">Persentase (%)</option>
                      <option value="fixed">Nominal (Rp)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-muted mb-1">Nilai</label>
                    <input
                      type="number"
                      required
                      value={voucherForm.discountValue}
                      onChange={(e) =>
                        setVoucherForm((f) => ({ ...f, discountValue: Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-sand text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-muted mb-1">
                      Min. Belanja
                    </label>
                    <input
                      type="number"
                      value={voucherForm.minOrderAmount}
                      onChange={(e) =>
                        setVoucherForm((f) => ({ ...f, minOrderAmount: Number(e.target.value) }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-sand text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-ink-muted mb-1">
                      Maks. Potongan
                    </label>
                    <input
                      type="number"
                      value={voucherForm.maxDiscountAmount}
                      onChange={(e) =>
                        setVoucherForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))
                      }
                      placeholder="Opsional"
                      className="w-full px-3 py-2 rounded-xl border border-sand text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-espresso text-white text-xs font-semibold"
                  >
                    + Simpan Voucher
                  </button>
                </form>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                  {vouchers.map((v) => (
                    <div
                      key={v.id}
                      className="bg-white rounded-2xl border border-sand p-4 shadow-card flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-sm text-espresso">{v.code}</span>
                        <p className="text-xs text-ink mt-0.5">
                          {v.discountType === "percentage"
                            ? `${v.discountValue}%`
                            : formatRupiah(v.discountValue)}{" "}
                          • Terpakai {v.usedCount}x
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/admin/vouchers?id=${v.id}`, { method: "DELETE" });
                          loadPromosAndVouchers();
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* QR Table Generator */}
              <section className="space-y-4">
                <h2 className="font-serif text-xl font-bold text-ink">
                  Generator QR Code Meja Dine-In
                </h2>
                <QrTablePanel />
              </section>
            </div>
          )}

          {/* 5. AUDIT LOG */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-sand p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Audit Log Aktivitas (Read-Only)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Rekaman sensitif perubahan stok, pembatalan pesanan, voucher, &amp; pengaturan.
                  </p>
                </div>

                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditPage(1);
                    setAuditActionFilter(e.target.value);
                  }}
                  className="px-3 py-2 rounded-xl border border-sand text-xs font-semibold bg-white"
                >
                  <option value="ALL">Semua Aksi</option>
                  <option value="ORDER_CANCELLED">ORDER_CANCELLED</option>
                  <option value="STOCK_RESET">STOCK_RESET</option>
                  <option value="PRODUCT_UPDATED">PRODUCT_UPDATED</option>
                  <option value="VOUCHER_CHANGED">VOUCHER_CHANGED</option>
                  <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
                </select>
              </div>

              <div className="bg-white rounded-2xl border border-sand shadow-card overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream border-b border-sand text-ink-muted uppercase">
                    <tr>
                      <th className="p-3.5">Waktu (WIB)</th>
                      <th className="p-3.5">Aktor</th>
                      <th className="p-3.5">Aksi</th>
                      <th className="p-3.5">Target</th>
                      <th className="p-3.5">Detail (Before vs After)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-cream/40">
                        <td className="p-3.5 whitespace-nowrap">
                          {formatWibDateTime(log.createdAt)}
                        </td>
                        <td className="p-3.5 font-semibold">{log.actorName}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-espresso/10 text-espresso font-mono font-bold">
                            {log.actionType}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold">{log.targetEntity}</td>
                        <td className="p-3.5 font-mono text-[11px] text-ink-muted max-w-md break-all">
                          {JSON.stringify(log.detailsJson)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">
                  Halaman {auditPage} dari {auditTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => p - 1)}
                    className="p-2 rounded-xl bg-white border border-sand disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages}
                    onClick={() => setAuditPage((p) => p + 1)}
                    className="p-2 rounded-xl bg-white border border-sand disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. STORE SETTINGS */}
          {activeTab === "settings" && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-white rounded-2xl border border-sand p-6 shadow-card space-y-4 max-w-3xl"
            >
              <h2 className="font-serif text-xl font-bold text-ink">Pengaturan Kafe</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Nama Kafe</label>
                  <input
                    type="text"
                    value={settings.cafeName}
                    onChange={(e) => setSettings((s) => ({ ...s, cafeName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">
                    Nomor WhatsApp Kasir (628...)
                  </label>
                  <input
                    type="text"
                    value={settings.whatsappNumber}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, whatsappNumber: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Tagline</label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => setSettings((s) => ({ ...s, tagline: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Alamat Lengkap</label>
                <textarea
                  rows={2}
                  value={settings.address}
                  onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-sand text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-muted mb-1">Jam Buka</label>
                  <input
                    type="text"
                    value={settings.openingHours}
                    onChange={(e) => setSettings((s) => ({ ...s, openingHours: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                  />
                </div>
                <label className="flex items-center gap-2.5 pt-5 cursor-pointer text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={settings.isOpenNow}
                    onChange={(e) => setSettings((s) => ({ ...s, isOpenNow: e.target.checked }))}
                    className="w-4 h-4 accent-espresso"
                  />
                  <span>Status Kafe Buka (Terima Pesanan)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">
                  Google Maps Embed URL
                </label>
                <input
                  type="text"
                  value={settings.mapsEmbedUrl}
                  onChange={(e) => setSettings((s) => ({ ...s, mapsEmbedUrl: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sand text-sm"
                />
              </div>

              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold"
              >
                Simpan Pengaturan
              </button>
            </form>
          )}
        </main>
      </div>

      {/* Root-level Strict Print & PDF Isolation Component */}
      <PrintableDocument paperSize={paperSize} data={printableData} />
    </>
  );
}

