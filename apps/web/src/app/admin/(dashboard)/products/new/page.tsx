"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useCreateProduct } from "@/lib/admin-products";

export default function NewProductPage() {
  const router = useRouter();
  const create = useCreateProduct();

  return (
    <div className="max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground mb-3 -ml-2">
        <Link href="/admin/products">
          <ArrowLeft /> All eBooks
        </Link>
      </Button>
      <PageHeader eyebrow="Store" title="New eBook" description="Save the details first, then upload the cover and PDF." />
      <ProductForm
        submitLabel="Create draft"
        onSubmit={async (input) => {
          const { product } = await create.mutateAsync(input);
          toast.success("Draft created. Now upload the cover and PDF.");
          router.replace(`/admin/products/${product.id}`);
        }}
      />
    </div>
  );
}
