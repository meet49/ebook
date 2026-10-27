"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ProductForm } from "@/components/admin/product-form";
import { AuthorGate } from "@/components/author/author-gate";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/client";
import { useCreateProduct } from "@/lib/admin-products";

export default function AuthorNewBookPage() {
  const router = useRouter();
  const t = useMessages().author.editor;
  const create = useCreateProduct("/author/products");

  return (
    <div className="max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground mb-3 -ml-2">
        <Link href="/author">
          <ArrowLeft /> {t.back}
        </Link>
      </Button>
      <PageHeader title={t.newTitle} description={t.newDescription} />
      <AuthorGate>
        {() => (
          <ProductForm
            variant="author"
            submitLabel={t.create}
            onSubmit={async (input) => {
              const { product } = await create.mutateAsync(input);
              toast.success(t.created);
              router.replace(`/author/books/${product.id}`);
            }}
          />
        )}
      </AuthorGate>
    </div>
  );
}
