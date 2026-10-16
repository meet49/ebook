import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/** 2:3 book cover with a branded fallback when no image has been uploaded. */
export function BookCover({
  src,
  title,
  className,
  priority,
  sizes = "(min-width: 1024px) 240px, 45vw",
}: {
  src: string | null;
  title: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted relative aspect-2/3 overflow-hidden rounded-r-xl rounded-l-sm shadow-md ring-1 ring-black/5",
        className,
      )}
    >
      {src ? (
        // Served same-origin through /api; already WebP-optimised by the API, so skip Next's optimiser.
        <Image src={src} alt={`Cover of ${title}`} fill unoptimized priority={priority} sizes={sizes} className="object-cover" />
      ) : (
        <div className="bg-gradient-brand flex h-full flex-col justify-between p-4 text-white">
          <BookOpen className="size-5 opacity-80" aria-hidden />
          <span className="line-clamp-4 text-lg leading-tight font-semibold">{title}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-black/10" aria-hidden />
    </div>
  );
}
