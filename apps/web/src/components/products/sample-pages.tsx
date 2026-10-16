"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function SamplePages({ title, samples }: { title: string; samples: { page: number; url: string }[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : samples[index];

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {samples.map((s, i) => (
          <button
            key={s.page}
            type="button"
            onClick={() => setIndex(i)}
            className="group focus-visible:ring-ring/50 relative aspect-[1/1.414] w-32 shrink-0 overflow-hidden rounded-lg border bg-white shadow-sm outline-none focus-visible:ring-3 sm:w-36"
            aria-label={`Open sample page ${s.page}`}
          >
            <Image src={s.url} alt="" fill unoptimized sizes="144px" className="object-cover object-top transition-transform group-hover:scale-105" />
            <span className="bg-background/90 absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium">
              p. {s.page}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={current !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent className="max-h-[95vh] w-full max-w-2xl gap-3 p-3 sm:p-4">
          <DialogTitle className="text-base">
            {title} — sample page {current?.page}
          </DialogTitle>
          <DialogDescription className="sr-only">Preview of a sample page from this eBook.</DialogDescription>
          {current && (
            <div className="relative mx-auto aspect-[1/1.414] max-h-[75vh] w-full overflow-hidden rounded-md border bg-white">
              <Image src={current.url} alt={`Sample page ${current.page}`} fill unoptimized sizes="672px" className="object-contain" />
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={!index} onClick={() => setIndex((i) => (i ?? 0) - 1)}>
              <ChevronLeft /> Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              {(index ?? 0) + 1} / {samples.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={index === null || index >= samples.length - 1}
              onClick={() => setIndex((i) => (i ?? 0) + 1)}
            >
              Next <ChevronRight />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
