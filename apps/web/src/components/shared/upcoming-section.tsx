import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Placeholder for dashboard sections whose features land in a later build phase. */
export function UpcomingSection({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <Empty className="bg-background min-h-[40vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Construction />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}
