import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer,
  badge,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-1">
          {badge}
          <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer ? <CardFooter className="text-muted-foreground flex-col gap-2 text-sm">{footer}</CardFooter> : null}
      </Card>
    </div>
  );
}
