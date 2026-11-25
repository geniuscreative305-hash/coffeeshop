import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return <AdminWorkspace adminName={session.name} adminEmail={session.email} />;
}

