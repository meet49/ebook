"use client";

import type { CommissionStatus } from "@ebook/shared";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMessages } from "@/i18n/client";
import { COMMISSION_STATUS_INFO } from "@/lib/affiliate";
import { cn } from "@/lib/utils";

/** The commission status label + help text in the viewer's language. */
export function useCommissionStatusText() {
  return useMessages().affiliate.status;
}

/** Status badge (colour + dot + text) with a plain-language explanation on hover/focus. */
export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  const text = useCommissionStatusText()[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className={cn("cursor-help gap-1.5", COMMISSION_STATUS_INFO[status].className)}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {text.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{text.help}</TooltipContent>
    </Tooltip>
  );
}
