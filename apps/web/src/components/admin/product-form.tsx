"use client";

import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  formatINR,
  paiseToRupeesString,
  rupeesToPaise,
  SLUG_PATTERN,
  type AdminProduct,
  type ProductInput,
} from "@ebook/shared";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminPageUrl } from "@/lib/admin-products";
import { handleFormError } from "@/lib/forms";
import { cn } from "@/lib/utils";

const money = /^\d{1,7}(\.\d{1,2})?$/;

const formSchema = z
  .object({
    title: z.string().trim().min(2, "Enter a title").max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .refine((v) => v === "" || SLUG_PATTERN.test(v), "Use lowercase letters, numbers and single hyphens"),
    subtitle: z.string().max(240),
    author: z.string().max(120),
    description: z.string().max(20_000),
    benefitsText: z.string().max(4000),
    categoriesText: z.string().max(400),
    language: z.string().trim().min(1, "Enter a language").max(40),
    price: z.string().trim().regex(money, "Enter an amount like 499 or 499.50"),
    salePrice: z
      .string()
      .trim()
      .refine((v) => v === "" || money.test(v), "Enter an amount like 299 or leave empty"),
    featured: z.boolean(),
    affiliateEnabled: z.boolean(),
    commissionType: z.enum(["percent", "fixed"]),
    commissionValue: z.string().trim().regex(money, "Enter a number"),
    previewPages: z.array(z.number().int().min(1)).max(10, "Choose at most 10 preview pages"),
    toc: z.array(z.object({ title: z.string().trim().min(1, "Enter a title").max(200), page: z.coerce.number().int().min(1) })).max(300),
  })
  .superRefine((v, ctx) => {
    if (!money.test(v.price) || (v.salePrice && !money.test(v.salePrice)) || !money.test(v.commissionValue)) return;
    const price = rupeesToPaise(v.price);
    if (price < 100) ctx.addIssue({ code: "custom", path: ["price"], message: "Price must be at least ₹1" });
    const sale = v.salePrice ? rupeesToPaise(v.salePrice) : null;
    if (sale !== null && sale >= price) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Must be lower than the regular price" });
    const value = rupeesToPaise(v.commissionValue);
    if (v.commissionType === "percent" && value > 10_000) ctx.addIssue({ code: "custom", path: ["commissionValue"], message: "Cannot exceed 100%" });
    if (v.commissionType === "fixed" && value > (sale ?? price)) {
      ctx.addIssue({ code: "custom", path: ["commissionValue"], message: "Cannot exceed the selling price" });
    }
  });

type FormValues = z.input<typeof formSchema>;

export function productToFormValues(p?: AdminProduct): FormValues {
  return {
    title: p?.title ?? "",
    slug: p?.slug ?? "",
    subtitle: p?.subtitle ?? "",
    author: p?.author ?? "",
    description: p?.description ?? "",
    benefitsText: p?.benefits.join("\n") ?? "",
    categoriesText: p?.categories.join(", ") ?? "",
    language: p?.language ?? "English",
    price: p ? paiseToRupeesString(p.pricePaise).replace(/\.00$/, "") : "",
    salePrice: p?.salePricePaise != null ? paiseToRupeesString(p.salePricePaise).replace(/\.00$/, "") : "",
    featured: p?.featured ?? false,
    affiliateEnabled: p?.affiliate.enabled ?? true,
    commissionType: p?.affiliate.type ?? "percent",
    // Percent is stored in basis points (2000 = 20%), fixed in paise — both convert like rupees.
    commissionValue: p ? paiseToRupeesString(p.affiliate.value).replace(/\.00$/, "") : "20",
    previewPages: p?.previewPages ?? [],
    toc: p?.toc ?? [],
  };
}

function toInput(v: z.output<typeof formSchema>): ProductInput {
  return {
    title: v.title,
    slug: v.slug || undefined,
    subtitle: v.subtitle.trim(),
    author: v.author.trim(),
    description: v.description,
    benefits: v.benefitsText.split("\n").map((s) => s.trim()).filter(Boolean),
    categories: v.categoriesText.split(",").map((s) => s.trim()).filter(Boolean),
    language: v.language,
    pricePaise: rupeesToPaise(v.price),
    salePricePaise: v.salePrice ? rupeesToPaise(v.salePrice) : null,
    featured: v.featured,
    affiliate: { enabled: v.affiliateEnabled, type: v.commissionType, value: rupeesToPaise(v.commissionValue) },
    previewPages: v.previewPages,
    toc: v.toc,
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ProductForm({
  product,
  submitLabel,
  onSubmit,
}: {
  product?: AdminProduct;
  submitLabel: string;
  onSubmit: (input: ProductInput) => Promise<unknown>;
}) {
  const form = useForm<FormValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: productToFormValues(product),
    resetOptions: { keepDirtyValues: true },
  });
  const toc = useFieldArray({ control: form.control, name: "toc" });
  const values = useWatch({ control: form.control });
  const pageCount = product?.pageCount ?? 0;

  const preview = (() => {
    if (!values.price || !values.commissionValue || !money.test(values.price) || !money.test(values.commissionValue)) return null;
    const price = rupeesToPaise(values.price);
    const charged = values.salePrice && money.test(values.salePrice) ? rupeesToPaise(values.salePrice) : price;
    const v = rupeesToPaise(values.commissionValue);
    const commission = values.commissionType === "percent" ? Math.floor((charged * v) / 10_000) : Math.min(v, charged);
    return { charged, commission };
  })();

  const submit = form.handleSubmit(async (v) => {
    try {
      await onSubmit(toInput(v));
    } catch (err) {
      // API field paths like "affiliate.value" map to form names where they differ.
      handleFormError(err, (name, error) => {
        const map: Record<string, keyof FormValues> = {
          pricePaise: "price",
          salePricePaise: "salePrice",
          "affiliate.value": "commissionValue",
          benefits: "benefitsText",
          categories: "categoriesText",
        };
        form.setError((map[name as string] ?? name) as keyof FormValues, error);
      });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Section title="Details" description="Shown on the store page.">
        <FieldGroup>
          <FormField control={form.control} name="title" label="Title">
            {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} />}
          </FormField>
          <FormField
            control={form.control}
            name="slug"
            label="URL slug"
            description={
              product?.status === "published"
                ? "Changing the slug of a published eBook breaks links people have already shared."
                : "Leave empty to generate it from the title."
            }
          >
            {({ field, id, invalid }) => (
              <div className="flex items-center">
                <span className="text-muted-foreground bg-muted flex h-9 items-center rounded-l-lg border border-r-0 px-2.5 text-sm">/ebooks/</span>
                <Input id={id} className="rounded-l-none" placeholder="the-art-of-focus" aria-invalid={invalid} {...field} />
              </div>
            )}
          </FormField>
          <FormField control={form.control} name="subtitle" label="Subtitle">
            {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} />}
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField control={form.control} name="author" label="Author">
              {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="language" label="Language">
              {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} />}
            </FormField>
          </div>
          <FormField control={form.control} name="description" label="Description" description="Line breaks are kept.">
            {({ field, id, invalid }) => <Textarea id={id} rows={8} aria-invalid={invalid} {...field} />}
          </FormField>
          <FormField control={form.control} name="benefitsText" label="Key benefits" description="One per line, up to 12.">
            {({ field, id, invalid }) => <Textarea id={id} rows={4} aria-invalid={invalid} {...field} />}
          </FormField>
          <FormField control={form.control} name="categoriesText" label="Categories" description="Comma-separated, e.g. Productivity, Career.">
            {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} />}
          </FormField>
          <Controller
            control={form.control}
            name="featured"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="featured" checked={field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor="featured">Feature on the home page</FieldLabel>
              </Field>
            )}
          />
        </FieldGroup>
      </Section>

      <Section title="Pricing" description="Prices in Indian Rupees. Checkout always charges the server-side price.">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField control={form.control} name="price" label="Regular price (₹)">
            {({ field, id, invalid }) => <Input id={id} inputMode="decimal" placeholder="499" aria-invalid={invalid} {...field} />}
          </FormField>
          <FormField control={form.control} name="salePrice" label="Discounted price (₹)" description="Optional.">
            {({ field, id, invalid }) => <Input id={id} inputMode="decimal" placeholder="299" aria-invalid={invalid} {...field} />}
          </FormField>
        </div>
      </Section>

      <Section title="Affiliate commission" description="Paid on verified sales only, never on clicks.">
        <FieldGroup>
          <Controller
            control={form.control}
            name="affiliateEnabled"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="affiliateEnabled" checked={field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor="affiliateEnabled">Affiliates can promote this eBook</FieldLabel>
              </Field>
            )}
          />
          {values.affiliateEnabled && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="commissionType"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="commissionType">Commission type</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="commissionType" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage of sale</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <FormField
                control={form.control}
                name="commissionValue"
                label={values.commissionType === "percent" ? "Commission (%)" : "Commission (₹)"}
              >
                {({ field, id, invalid }) => <Input id={id} inputMode="decimal" aria-invalid={invalid} {...field} />}
              </FormField>
            </div>
          )}
          {values.affiliateEnabled && preview && (
            <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-sm">
              On a sale at {formatINR(preview.charged)} the affiliate earns <strong className="text-foreground">{formatINR(preview.commission)}</strong>,
              leaving {formatINR(preview.charged - preview.commission)} before other expenses.
            </p>
          )}
        </FieldGroup>
      </Section>

      <Section
        title="Preview pages"
        description={pageCount ? "Pages anyone can view as a watermarked sample (up to 10)." : "Available after the PDF has been processed."}
      >
        {pageCount > 0 && product ? (
          <Controller
            control={form.control}
            name="previewPages"
            render={({ field, fieldState }) => (
              <PreviewPicker
                productId={product.id}
                version={product.updatedAt}
                pageCount={pageCount}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        ) : (
          <p className="text-muted-foreground text-sm">Upload the PDF first.</p>
        )}
      </Section>

      <Section title="Table of contents" description="Filled automatically from the PDF's bookmarks when available. Prefix sub-sections with “— ”.">
        <div className="space-y-2">
          {toc.fields.map((item, i) => (
            <div key={item.id} className="flex items-start gap-2">
              <Controller
                control={form.control}
                name={`toc.${i}.title`}
                render={({ field, fieldState }) => (
                  <div className="flex-1">
                    <Input aria-label={`Entry ${i + 1} title`} aria-invalid={fieldState.invalid} {...field} />
                    {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                  </div>
                )}
              />
              <Controller
                control={form.control}
                name={`toc.${i}.page`}
                render={({ field }) => (
                  <Input
                    aria-label={`Entry ${i + 1} page`}
                    type="number"
                    min={1}
                    max={pageCount || undefined}
                    className="w-24"
                    {...field}
                    value={String(field.value ?? "")}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || "")}
                  />
                )}
              />
              <Button type="button" variant="ghost" size="icon-lg" aria-label={`Remove entry ${i + 1}`} onClick={() => toc.remove(i)}>
                <Trash2 />
              </Button>
            </div>
          ))}
          {form.formState.errors.toc?.root?.message || form.formState.errors.toc?.message ? (
            <FieldError>{form.formState.errors.toc?.root?.message ?? form.formState.errors.toc?.message}</FieldError>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => toc.append({ title: "", page: 1 })}>
            <Plus /> Add entry
          </Button>
        </div>
      </Section>

      <div className="bg-background/90 sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function PreviewPicker({
  productId,
  version,
  pageCount,
  value,
  onChange,
  error,
}: {
  productId: string;
  version: string;
  pageCount: number;
  value: number[];
  onChange: (v: number[]) => void;
  error?: string;
}) {
  const [extra, setExtra] = useState("");
  const shown = Math.min(pageCount, 12);
  const toggle = (n: number) => onChange(value.includes(n) ? value.filter((p) => p !== n) : [...value, n].sort((a, b) => a - b));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: shown }, (_, i) => i + 1).map((n) => {
          const selected = value.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              aria-pressed={selected}
              className={cn(
                "relative aspect-[1/1.414] overflow-hidden rounded-md border-2 bg-white transition",
                selected ? "border-primary ring-primary/30 ring-3" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image src={adminPageUrl(productId, n, version)} alt={`Page ${n}`} fill unoptimized sizes="120px" className="object-cover object-top" />
              <span className="bg-background/90 absolute bottom-1 left-1 rounded px-1 text-xs font-medium">{n}</span>
            </button>
          );
        })}
      </div>
      {pageCount > shown && (
        <div className="flex max-w-xs items-center gap-2">
          <Input
            type="number"
            min={1}
            max={pageCount}
            placeholder={`Page 1–${pageCount}`}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            aria-label="Add a preview page by number"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const n = Number(extra);
              if (Number.isInteger(n) && n >= 1 && n <= pageCount && !value.includes(n)) toggle(n);
              setExtra("");
            }}
          >
            Add
          </Button>
        </div>
      )}
      <FieldDescription>Selected: {value.length ? value.join(", ") : "none"}</FieldDescription>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
