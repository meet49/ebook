import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/** 2:3 book cover with a spine highlight and a branded fallback when no image has been uploaded. */
export function BookCover({
  src,
  title,
  className,
  priority,
  sizes = "(min-width: 1024px) 240px, 45vw",
  alt,
}: {
  src: string | null;
  title: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Defaults to "Cover of <title>". */
  alt?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted relative aspect-2/3 overflow-hidden rounded-l-sm rounded-r-xl shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] ring-1 ring-black/5 dark:ring-white/10",
        className,
      )}
    >
      {src ? (
        // Served same-origin through /api; already WebP-optimised by the API, so skip Next's optimiser.
        <Image src={src} alt={alt ?? `Cover of ${title}`} fill unoptimized priority={priority} sizes={sizes} className="object-cover" />
      ) : (
        <div className="bg-gradient-brand flex h-full flex-col justify-between p-4 text-white">
          <BookOpen className="size-5 opacity-80" aria-hidden />
          <span className="line-clamp-4 text-lg leading-tight font-semibold">{title}</span>
        </div>
      )}
      {/* Spine: a dark fold with a soft highlight, so flat covers read as books. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-linear-to-r from-black/25 via-white/15 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-transparent to-white/15" aria-hidden />
    </div>
  );
}
