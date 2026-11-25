import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { uploadImageToStorage } from "@/lib/storage";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folderRaw = String(formData.get("folder") || "products");
    const folder = folderRaw === "promos" ? "promos" : "products";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File gambar tidak ditemukan." }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Format file tidak didukung. Gunakan JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 5MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await uploadImageToStorage(buffer, file.type, folder);

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Gagal mengunggah gambar." }, { status: 500 });
  }
}
