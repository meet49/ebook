import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/i18n/server";

export default async function NotFound() {
  const t = (await getMessages()).library.notFound;
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="bg-primary/10 absolute top-1/2 left-1/2 -z-10 size-120 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      />
      <span className="bg-gradient-brand shadow-primary/20 mb-6 flex size-14 items-center justify-center rounded-2xl text-white shadow-lg">
        <BookOpen className="size-6" aria-hidden />
      </span>
      <p className="font-display text-gradient-brand pr-2 text-8xl leading-none italic sm:text-9xl">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{t.title}</h1>
      <p className="text-muted-foreground mt-2 max-w-sm">{t.body}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/">
            <ArrowLeft aria-hidden />
            {t.home}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/ebooks">{t.browse}</Link>
        </Button>
      </div>
    </div>
  );
}
