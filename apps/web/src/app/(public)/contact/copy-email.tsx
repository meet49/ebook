"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyEmailButton({ email, label, copiedLabel }: { email: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      className="rounded-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          toast.success(copiedLabel);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked (e.g. insecure context): the address is visible on the page anyway.
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {label}
    </Button>
  );
}
