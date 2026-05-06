"use client";

import { useRef, useState } from "react";
import { upload } from "@imagekit/next";

type ImageKitAuthResponse = {
  success?: boolean;
  message?: string;
  token?: string;
  expire?: number;
  signature?: string;
  publicKey?: string;
  urlEndpoint?: string;
};

type ImageKitUploadFieldProps = {
  label?: string;
  hint?: string;
  folder: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
};

const MAX_IMAGE_SIZE = 12 * 1024 * 1024;

function safeFileName(name: string) {
  const normalized = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return normalized || `image-${Date.now()}.jpg`;
}

async function getImageKitAuth(): Promise<Required<Omit<ImageKitAuthResponse, "success" | "message">>> {
  const res = await fetch("/api/admin/imagekit/auth", {
    cache: "no-store",
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as ImageKitAuthResponse;

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Не удалось получить подпись ImageKit");
  }
  if (!data.token || !data.expire || !data.signature || !data.publicKey || !data.urlEndpoint) {
    throw new Error("ImageKit вернул неполные параметры загрузки");
  }

  return {
    token: data.token,
    expire: data.expire,
    signature: data.signature,
    publicKey: data.publicKey,
    urlEndpoint: data.urlEndpoint,
  };
}

export default function ImageKitUploadField({
  label = "Загрузить в ImageKit",
  hint = "JPG, PNG, WEBP до 12 МБ",
  folder,
  onUploaded,
  disabled,
}: ImageKitUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    setError(null);
    setLastUrl(null);
    setProgress(0);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Можно загружать только изображения");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Файл больше 12 МБ");
      return;
    }

    setUploading(true);
    try {
      const auth = await getImageKitAuth();
      const result = await upload({
        file,
        fileName: safeFileName(file.name),
        folder,
        useUniqueFileName: true,
        publicKey: auth.publicKey,
        token: auth.token,
        expire: auth.expire,
        signature: auth.signature,
        onProgress: (event) => {
          if (!event.lengthComputable) return;
          setProgress(Math.round((event.loaded / event.total) * 100));
        },
      });

      if (!result.url) throw new Error("ImageKit не вернул URL файла");
      setLastUrl(result.url);
      onUploaded(result.url);
    } catch (err: any) {
      setError(err?.message || "Ошибка загрузки в ImageKit");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? `Загрузка ${progress || 1}%` : label}
        </button>
        <span className="text-xs text-black/50">{hint}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      {uploading && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-black transition-[width]"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
      )}
      {lastUrl && <div className="mt-2 truncate text-xs text-green-700">Загружено: {lastUrl}</div>}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  );
}
