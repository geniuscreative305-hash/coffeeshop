'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, RefreshCw, Loader2, ImageIcon } from 'lucide-react';
import { useToast } from './ToastProvider';

interface ImageDropzoneProps {
  aspectRatio: '1:1' | '16:9';
  folder: 'products' | 'promos';
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

/**
 * Direct Device Image Upload + Auto Center-Crop (1:1 800x800 or 16:9 1280x720)
 * + Client-Side WebP 85% compression (JPEG fallback for older Safari).
 */
async function cropAndCompressImage(
  file: File,
  aspectRatio: '1:1' | '16:9'
): Promise<{ blob: Blob; previewUrl: string; mime: string }> {
  const targetW = aspectRatio === '1:1' ? 800 : 1280;
  const targetH = aspectRatio === '1:1' ? 800 : 720;
  const targetRatio = targetW / targetH;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('File bukan gambar yang valid.'));
    image.src = dataUrl;
  });

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const srcRatio = srcW / srcH;

  let cropW = srcW;
  let cropH = srcH;
  let offsetX = 0;
  let offsetY = 0;

  if (srcRatio > targetRatio) {
    // Source is wider -> crop horizontally from center
    cropW = Math.round(srcH * targetRatio);
    offsetX = Math.round((srcW - cropW) / 2);
  } else if (srcRatio < targetRatio) {
    // Source is taller (e.g. vertical phone photo) -> crop vertically from center
    cropH = Math.round(srcW / targetRatio);
    offsetY = Math.round((srcH - cropH) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung HTML5 Canvas.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, targetW, targetH);

  // Try WebP 85%, fallback to JPEG 85%
  const tryToBlob = (mime: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.85));

  let outBlob = await tryToBlob('image/webp');
  let outMime = 'image/webp';

  if (!outBlob || outBlob.type !== 'image/webp') {
    outBlob = await tryToBlob('image/jpeg');
    outMime = 'image/jpeg';
  }

  if (!outBlob) {
    throw new Error('Gagal mengompresi gambar.');
  }

  const previewUrl = URL.createObjectURL(outBlob);
  return { blob: outBlob, previewUrl, mime: outMime };
}

export function ImageDropzone({
  aspectRatio,
  folder,
  value,
  onChange,
  label,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string>('');

  const handleFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Gunakan gambar berformat JPG, PNG, atau WebP.', 'error');
      return;
    }

    setUploading(true);
    try {
      const { blob, previewUrl, mime } = await cropAndCompressImage(file, aspectRatio);
      setLocalPreview(previewUrl);

      if (blob.size > 5 * 1024 * 1024) {
        showToast('Ukuran hasil kompresi melebihi 5MB.', 'error');
        setUploading(false);
        return;
      }

      const ext = mime === 'image/webp' ? 'webp' : 'jpg';
      const uploadFile = new File([blob], `upload.${ext}`, { type: mime });
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('folder', folder);
      if (value) {
        formData.append('oldUrl', value);
      }

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload gagal');
      }

      onChange(data.url);
      showToast('Gambar berhasil dipotong otomatis & diunggah!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah gambar.';
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const displaySrc = localPreview || value;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-ink-primary">{label}</label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
          aspectRatio === '1:1' ? 'aspect-square max-w-[240px]' : 'aspect-video w-full'
        } ${
          dragging
            ? 'border-espresso bg-espresso/5'
            : 'border-borderWarm bg-cream/60 hover:border-caramel'
        }`}
      >
        {displaySrc ? (
          <>
            <img
              src={displaySrc}
              alt="Preview gambar"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 flex items-center justify-between">
              <span className="text-xs font-medium text-white">
                Auto Center-Crop {aspectRatio}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-espresso shadow">
                <RefreshCw className="w-3.5 h-3.5" />
                Ganti Gambar
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
            <div className="w-11 h-11 rounded-full bg-white border border-borderWarm flex items-center justify-center text-espresso mb-2 shadow-sm">
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UploadCloud className="w-5 h-5" />
              )}
            </div>
            <p className="text-xs font-semibold text-ink-primary">
              Klik atau seret foto dari perangkat
            </p>
            <p className="text-[11px] text-ink-secondary mt-1">
              Otomatis center-crop {aspectRatio} & kompresi WebP
            </p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center text-white gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs font-semibold">Memproses & Mengunggah...</span>
          </div>
        )}
      </div>

      {!displaySrc && (
        <p className="text-[11px] text-ink-secondary flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5" />
          Mendukung Galeri/Kamera HP & File Explorer (Maks. 5MB)
        </p>
      )}
    </div>
  );
}
