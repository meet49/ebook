import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateApplyForm } from "@/components/affiliate/apply-form";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Apply to the affiliate program" };

export default function AffiliateApplyPage() {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/affiliates" className="text-muted-foreground hover:text-foreground text-sm">
          Program details
        </Link>
      </div>
      <div className="flex flex-1 justify-center px-4 py-8 sm:py-12">
        <Card className="w-full max-w-xl shadow-sm">
          <CardHeader className="space-y-1">
            <Badge variant="secondary" className="mb-2 w-fit">
              Affiliate program
            </Badge>
            <CardTitle className="text-2xl tracking-tight">Apply to become an affiliate</CardTitle>
            <CardDescription>Applications are usually reviewed within 2 business days.</CardDescription>
          </CardHeader>
          <CardContent>
            <AffiliateApplyForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
