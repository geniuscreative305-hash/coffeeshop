import React from "react";
import { getCachedCatalog } from "@/lib/catalog";
import { StorefrontClient } from "@/components/storefront/StorefrontClient";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ meja?: string; table?: string }>;
}) {
  const params = await searchParams;
  const catalog = await getCachedCatalog();
  const initialTable = params.meja || params.table || null;

  return (
    <StorefrontClient
      initialCatalog={catalog}
      initialTableParam={initialTable}
    />
  );
}

