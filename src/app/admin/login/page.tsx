"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Lock, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export default function AdminLoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Login gagal.", "error");
        return;
      }
      showToast("Berhasil masuk ke panel admin.", "success");
      router.push("/admin");
      router.refresh();
    } catch {
      showToast("Gagal menghubungi server.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-sand shadow-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-espresso text-white flex items-center justify-center mx-auto shadow-sm">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink">
            Portal Operasional Kasir
          </h1>
          <p className="text-xs text-ink-muted">
            Masuk menggunakan akun admin terdaftar untuk mengelola pesanan &amp; menu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Email Admin
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@coffee.id"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-sand bg-cream/40 text-sm focus:outline-none focus:border-espresso"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-sand bg-cream/40 text-sm focus:outline-none focus:border-espresso"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-espresso hover:bg-espresso-hover text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Masuk ke Dashboard</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

