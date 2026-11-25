"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Plus, Trash2, QrCode } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

interface TableRow {
  id: number;
  tableNumber: string;
  qrToken: string;
  isActive: boolean;
}

export function QrTablePanel() {
  const { showToast } = useToast();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [newTableNum, setNewTableNum] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    loadTables();
  }, []);

  const loadTables = async () => {
    const res = await fetch("/api/admin/tables");
    if (res.ok) {
      const data = await res.json();
      setTables(data.tables || []);
    }
  };

  useEffect(() => {
    if (!origin || tables.length === 0) return;
    let active = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const t of tables) {
        const url = `${origin}/?meja=${encodeURIComponent(t.tableNumber)}`;
        next[t.tableNumber] = await QRCode.toDataURL(url, {
          width: 360,
          margin: 2,
          color: { dark: "#23170F", light: "#FFFFFF" },
        });
      }
      if (active) setQrMap(next);
    })();
    return () => {
      active = false;
    };
  }, [origin, tables]);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;
    const res = await fetch("/api/admin/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber: newTableNum.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal menambah meja.", "error");
      return;
    }
    setNewTableNum("");
    showToast(`Meja ${data.table.tableNumber} ditambahkan.`, "success");
    loadTables();
  };

  const handleDeleteTable = async (id: number) => {
    const res = await fetch(`/api/admin/tables?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Meja dihapus.", "success");
      loadTables();
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleAddTable}
        className="bg-white rounded-2xl border border-sand p-4 flex flex-wrap items-center gap-3"
      >
        <QrCode className="w-5 h-5 text-espresso" />
        <input
          type="text"
          value={newTableNum}
          onChange={(e) => setNewTableNum(e.target.value)}
          placeholder="Nomor Meja Baru (misal: 06 atau VIP-1)"
          className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border border-sand text-sm focus:outline-none focus:border-espresso"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Tambah Meja
        </button>
      </form>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
        {tables.map((t) => (
          <div
            key={t.id}
            className="bg-white rounded-2xl border border-sand p-4 shadow-card flex flex-col items-center text-center gap-3"
          >
            <div className="w-full flex items-center justify-between">
              <span className="font-serif text-base font-bold text-ink">
                Meja {t.tableNumber}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteTable(t.id)}
                className="text-ink-muted hover:text-rose-600 p-1"
                aria-label="Hapus meja"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {qrMap[t.tableNumber] && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrMap[t.tableNumber]}
                alt={`QR Meja ${t.tableNumber}`}
                className="w-40 h-40 rounded-xl border border-sand"
              />
            )}

            <p className="text-[11px] text-ink-muted break-all">
              /?meja={t.tableNumber}
            </p>

            {qrMap[t.tableNumber] && (
              <a
                href={qrMap[t.tableNumber]}
                download={`QR-Meja-${t.tableNumber}.png`}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cream border border-sand hover:border-espresso text-xs font-semibold text-espresso transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Unduh PNG
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

