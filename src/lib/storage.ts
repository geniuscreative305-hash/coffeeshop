import { put, del } from "@vercel/blob";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

function isVercelBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim() !== "");
}

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL
  );
}

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadImageToStorage(
  buffer: Buffer,
  contentType: string,
  folder: "products" | "promos"
): Promise<string> {
  const ext = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";
  const filename = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  // 1. Primary: Vercel Blob
  if (isVercelBlobConfigured()) {
    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  // 2. Alternative: Cloudflare R2 (S3-Compatible)
  if (isR2Configured()) {
    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
      })
    );
    const publicBase = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");
    return `${publicBase}/${filename}`;
  }

  // 3. Local development fallback (/public/uploads)
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });
  const localName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const fullPath = path.join(uploadDir, localName);
  await writeFile(fullPath, buffer);
  return `/uploads/${folder}/${localName}`;
}

export async function deleteImageFromStorage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;
  // Never delete static seed assets
  if (imageUrl.startsWith("/images/seed/")) return;

  try {
    if (isVercelBlobConfigured() && imageUrl.includes("vercel-storage.com")) {
      await del(imageUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return;
    }

    if (isR2Configured() && process.env.R2_PUBLIC_URL && imageUrl.startsWith(process.env.R2_PUBLIC_URL)) {
      const publicBase = process.env.R2_PUBLIC_URL.replace(/\/+$/, "") + "/";
      const key = imageUrl.replace(publicBase, "");
      const client = getR2Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
        })
      );
      return;
    }

    if (imageUrl.startsWith("/uploads/")) {
      const localPath = path.join(process.cwd(), "public", imageUrl);
      await unlink(localPath);
    }
  } catch (err) {
    console.warn("Orphan file cleanup warning:", err);
  }
}
