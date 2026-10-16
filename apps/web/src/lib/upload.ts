import type { ApiErrorBody } from "@ebook/shared";
import { ApiError } from "./api";

/**
 * Multipart upload with progress reporting (fetch cannot report upload progress).
 * Same-origin request, so the session cookie is sent automatically.
 */
export function uploadFile<T>(path: string, file: File, onProgress?: (percent: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1${path}`);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as T);
      const error = (xhr.response as ApiErrorBody | null)?.error;
      reject(
        new ApiError(
          xhr.status,
          error?.code ?? "UPLOAD_FAILED",
          error?.message ?? (xhr.status === 413 ? "The file is too large" : "Upload failed. Please try again."),
          error?.details,
        ),
      );
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "Upload failed. Check your connection and try again."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
