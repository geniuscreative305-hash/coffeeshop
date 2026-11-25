"use client";

import React from "react";
import { formatRupiah, formatWibDateTime } from "@/lib/format";
import type { OrderItemJson } from "@/db/schema";

export type PaperSize = "A4" | "A5";

export interface PrintableInvoiceData {
  type: "invoice";
  cafeName: string;
  cafeAddress: string;
  orderCode: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  tableNumber: string | null;
  paymentMethod: string;
  orderStatus: string;
  items: OrderItemJson[];
  subtotal: number;
  voucherCode: string | null;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
}

export interface PrintableReportData {
  type: "report";
  cafeName: string;
  cafeAddress: string;
  periodLabel: string;
  printedAt: string;
  summary: {
    grossRevenue: number;
    totalDiscount: number;
    netRevenue: number;
    completedCount: number;
    activeCount: number;
  };
  byCategory: { category: string; total: number }[];
  byPayment: { method: string; total: number; count: number }[];
  orders: {
    orderCode: string;
    createdAt: string;
    customerName: string;
    orderType: string;
    tableNumber: string | null;
    paymentMethod: string;
    orderStatus: string;
    totalAmount: number;
  }[];
}

export type PrintablePayload = PrintableInvoiceData | PrintableReportData | null;

interface PrintableDocumentProps {
  paperSize: PaperSize;
  data: PrintablePayload;
}

/**
 * Rendered at the root level (#printable-sheet) outside any admin/dashboard wrapper.
 * Hidden on screen (@media screen), sole visible tree on @media print.
 */
export function PrintableDocument({ paperSize, data }: PrintableDocumentProps) {
  if (!data) {
    return <div id="printable-sheet" aria-hidden="true" />;
  }

  const pageCss =
    paperSize === "A5"
      ? "@page { size: A5 portrait; margin: 10mm; }"
      : "@page { size: A4 portrait; margin: 12mm; }";

  return (
    <div id="printable-sheet">
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />

      {data.type === "invoice" ? (
        <div className="bg-white text-black font-sans text-xs leading-relaxed">
          <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold tracking-tight uppercase">{data.cafeName}</h1>
              <p className="text-[11px] text-neutral-700 max-w-xs">{data.cafeAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">STRUK PESANAN</p>
              <p className="font-mono font-semibold">{data.orderCode}</p>
              <p className="text-[10px] text-neutral-600">{formatWibDateTime(data.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 text-[11px] border-b border-neutral-300 pb-3">
            <div>
              <p>
                <span className="font-semibold">Pelanggan:</span> {data.customerName}
              </p>
              <p>
                <span className="font-semibold">Telepon:</span> {data.customerPhone}
              </p>
            </div>
            <div className="text-right">
              <p>
                <span className="font-semibold">Tipe:</span> {data.orderType}
                {data.tableNumber ? ` (Meja ${data.tableNumber})` : ""}
              </p>
              <p>
                <span className="font-semibold">Pembayaran:</span> {data.paymentMethod} •{" "}
                {data.orderStatus}
              </p>
            </div>
          </div>

          <table className="w-full border-collapse mb-4 text-[11px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1.5 font-bold">Item</th>
                <th className="py-1.5 text-center font-bold">Qty</th>
                <th className="py-1.5 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-200 break-inside-avoid">
                  <td className="py-1.5 pr-2">
                    <div className="font-semibold">{item.name}</div>
                    {item.selected_variants?.length > 0 && (
                      <div className="text-[10px] text-neutral-600">
                        {item.selected_variants
                          .map((v) => `${v.group_name}: ${v.option_name}`)
                          .join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 text-center align-top">{item.qty}</td>
                  <td className="py-1.5 text-right align-top font-medium">
                    {formatRupiah(item.item_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.notes && (
            <div className="mb-3 p-2 border border-neutral-300 text-[11px] break-inside-avoid">
              <span className="font-semibold">Catatan:</span> {data.notes}
            </div>
          )}

          <div className="border-t border-black pt-2 space-y-1 text-xs break-inside-avoid">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatRupiah(data.subtotal)}</span>
            </div>
            {data.discountAmount > 0 && (
              <div className="flex justify-between">
                <span>Diskon {data.voucherCode ? `(${data.voucherCode})` : ""}</span>
                <span>-{formatRupiah(data.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-neutral-300 pt-1.5">
              <span>TOTAL BAYAR</span>
              <span>{formatRupiah(data.totalAmount)}</span>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-dashed border-neutral-400 text-center text-[10px] text-neutral-600 break-inside-avoid">
            Terima kasih telah berkunjung ke {data.cafeName}.
          </div>
        </div>
      ) : (
        <div className="bg-white text-black font-sans text-xs leading-relaxed">
          <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight">{data.cafeName}</h1>
              <p className="text-[11px] text-neutral-700">{data.cafeAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">LAPORAN PENJUALAN & CLOSING SHIFT</p>
              <p className="text-[11px]">Periode: {data.periodLabel}</p>
              <p className="text-[10px] text-neutral-600">Dicetak: {data.printedAt}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5 break-inside-avoid">
            <div className="border border-neutral-400 p-2.5">
              <p className="text-[10px] uppercase text-neutral-600">Omzet Kotor</p>
              <p className="text-sm font-bold">{formatRupiah(data.summary.grossRevenue)}</p>
            </div>
            <div className="border border-neutral-400 p-2.5">
              <p className="text-[10px] uppercase text-neutral-600">Total Diskon</p>
              <p className="text-sm font-bold">-{formatRupiah(data.summary.totalDiscount)}</p>
            </div>
            <div className="border border-neutral-400 p-2.5">
              <p className="text-[10px] uppercase text-neutral-600">Omzet Bersih</p>
              <p className="text-sm font-bold">{formatRupiah(data.summary.netRevenue)}</p>
            </div>
            <div className="border border-neutral-400 p-2.5">
              <p className="text-[10px] uppercase text-neutral-600">Transaksi Sukses</p>
              <p className="text-sm font-bold">{data.summary.completedCount} Order</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5 break-inside-avoid">
            <div>
              <h3 className="font-bold border-b border-black pb-1 mb-1.5 text-[11px] uppercase">
                Rincian Per Kategori
              </h3>
              <table className="w-full text-[11px]">
                <tbody>
                  {data.byCategory.map((c) => (
                    <tr key={c.category} className="border-b border-neutral-200">
                      <td className="py-1">{c.category}</td>
                      <td className="py-1 text-right font-semibold">{formatRupiah(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-bold border-b border-black pb-1 mb-1.5 text-[11px] uppercase">
                Rincian Per Metode Bayar
              </h3>
              <table className="w-full text-[11px]">
                <tbody>
                  {data.byPayment.map((p) => (
                    <tr key={p.method} className="border-b border-neutral-200">
                      <td className="py-1">
                        {p.method} ({p.count}x)
                      </td>
                      <td className="py-1 text-right font-semibold">{formatRupiah(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h3 className="font-bold border-b border-black pb-1 mb-2 text-[11px] uppercase">
            Daftar Transaksi
          </h3>
          <table className="w-full border-collapse text-[11px] mb-8">
            <thead>
              <tr className="border-b border-black text-left bg-neutral-100">
                <th className="py-1.5 px-1">Kode Order</th>
                <th className="py-1.5 px-1">Waktu</th>
                <th className="py-1.5 px-1">Pelanggan</th>
                <th className="py-1.5 px-1">Tipe / Meja</th>
                <th className="py-1.5 px-1">Bayar</th>
                <th className="py-1.5 px-1">Status</th>
                <th className="py-1.5 px-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((ord) => (
                <tr key={ord.orderCode} className="border-b border-neutral-200 break-inside-avoid">
                  <td className="py-1.5 px-1 font-mono">{ord.orderCode}</td>
                  <td className="py-1.5 px-1">{formatWibDateTime(ord.createdAt)}</td>
                  <td className="py-1.5 px-1">{ord.customerName}</td>
                  <td className="py-1.5 px-1">
                    {ord.orderType}
                    {ord.tableNumber ? ` #${ord.tableNumber}` : ""}
                  </td>
                  <td className="py-1.5 px-1">{ord.paymentMethod}</td>
                  <td className="py-1.5 px-1">{ord.orderStatus}</td>
                  <td className="py-1.5 px-1 text-right font-semibold">
                    {formatRupiah(ord.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mt-8 pt-4 break-inside-avoid text-[11px]">
            <div className="text-center">
              <p className="mb-14">Disiapkan Oleh (Kasir Shift),</p>
              <p className="font-semibold border-t border-black inline-block px-8 pt-1">
                ( .............................. )
              </p>
            </div>
            <div className="text-center">
              <p className="mb-14">Disetujui Oleh (Store Manager),</p>
              <p className="font-semibold border-t border-black inline-block px-8 pt-1">
                ( .............................. )
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

