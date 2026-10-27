"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, PenLine, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authorProfileInputSchema, type AuthorProfileDto, type AuthorProfileInput } from "@ebook/shared";
import { IconChip } from "@/components/dashboard/list-ui";
import { PayoutDetailsCard } from "@/components/dashboard/payout-details-card";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { authorProfileKey, useAuthorProfile } from "@/lib/author";
import { handleFormError } from "@/lib/forms";

export default function AuthorProfilePage() {
  const m = useMessages();
  const t = m.author.profile;
  const qc = useQueryClient();
  const { data: profile, isPending } = useAuthorProfile();
  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      {isPending ? (
        <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !profile ? (
        <Empty className="bg-card rounded-2xl border border-solid">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>{m.author.gate.joinTitle}</EmptyTitle>
            <EmptyDescription>{m.author.gate.joinBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/author/apply">
                {m.author.gate.applyNow} <ArrowRight />
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid max-w-5xl items-start gap-6 lg:grid-cols-2">
          <DetailsCard profile={profile} />
          <PayoutDetailsCard payout={profile.payout} endpoint="/author/me/payout" onSaved={(p: AuthorProfileDto) => qc.setQueryData(authorProfileKey, p)} />
        </div>
      )}
    </>
  );
}

function DetailsCard({ profile }: { profile: AuthorProfileDto }) {
  const t = useMessages().author;
  const qc = useQueryClient();
  const form = useForm<AuthorProfileInput>({
    resolver: zodResolver(authorProfileInputSchema),
    defaultValues: { penName: profile.penName, bio: profile.bio, website: profile.website },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const { profile: updated } = await api<{ profile: AuthorProfileDto }>("/author/me", { method: "PUT", body: values });
      qc.setQueryData(authorProfileKey, updated);
      toast.success(t.profile.saved);
    } catch (err) {
      handleFormError(err, form.setError);
    }
  });

  return (
    <Card className="rounded-2xl">
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <CardHeader>
          <div className="flex items-start gap-3">
            <IconChip icon={PenLine} tone="violet" />
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle>{t.profile.detailsTitle}</CardTitle>
              <CardDescription>{t.profile.detailsDescription}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {profile.status === "approved" && <p className="bg-primary/5 border-primary/20 rounded-xl border p-3 text-sm">{t.profile.share(profile.sharePercent)}</p>}
          <FieldGroup>
            <FormField control={form.control} name="penName" label={t.form.penName}>
              {({ field, id, invalid }) => <Input id={id} aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="bio" label={t.form.bio} description={t.form.optional}>
              {({ field, id, invalid }) => <Textarea id={id} rows={4} aria-invalid={invalid} {...field} />}
            </FormField>
            <FormField control={form.control} name="website" label={t.form.website} description={t.form.optional}>
              {({ field, id, invalid }) => <Input id={id} type="url" placeholder="https://" aria-invalid={invalid} {...field} />}
            </FormField>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spinner /> : null}
            {t.profile.save}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
