import { CustomerShell } from "@/components/layout/portal-shells";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <CustomerShell>{children}</CustomerShell>
      </main>
      <SiteFooter />
    </>
  );
}
