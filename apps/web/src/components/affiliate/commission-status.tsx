"use client";

import type { CommissionStatus } from "@ebook/shared";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COMMISSION_STATUS_INFO } from "@/lib/affiliate";
import { cn } from "@/lib/utils";

/** Status badge with a plain-language explanation on hover. */
export function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  const info = COMMISSION_STATUS_INFO[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn(info.className)}>
          {info.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{info.help}</TooltipContent>
    </Tooltip>
  );
}
