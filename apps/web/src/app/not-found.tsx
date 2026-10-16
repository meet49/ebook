import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-gradient-brand text-6xl font-semibold">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="text-muted-foreground max-w-sm">The link may be broken, or the page may have been moved.</p>
      <Button asChild>
        <Link href="/">Back to the store</Link>
      </Button>
    </div>
  );
}
