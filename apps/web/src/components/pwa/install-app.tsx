"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMessages } from "@/i18n/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The browser fires `beforeinstallprompt` once, often before React mounts, so keep it globally.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const noop = () => () => {};

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function useInstallState() {
  const prompt = useSyncExternalStore(subscribe, () => deferred, () => null);
  // Browser-only facts; the server snapshot hides the button until hydration.
  const standalone = useSyncExternalStore(noop, isStandalone, () => true);
  const ios = useSyncExternalStore(noop, isIos, () => false);
  return { prompt, standalone, ios };
}

/**
 * "Install app" button. Uses the browser's install prompt where available (Chrome, Edge,
 * Android) and shows Add-to-Home-Screen steps on iPhone/iPad. Hidden once installed.
 */
export function InstallAppButton({
  variant = "outline",
  size = "sm",
  className,
  showWithoutPrompt = false,
}: {
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Also show (with manual steps) when the browser hasn't offered an install prompt. */
  showWithoutPrompt?: boolean;
}) {
  const t = useMessages().common.pwa;
  const { prompt, standalone, ios } = useInstallState();
  const [help, setHelp] = useState(false);

  if (standalone) return null;
  if (!prompt && !ios && !showWithoutPrompt) return null;

  const install = async () => {
    if (!prompt) {
      setHelp(true);
      return;
    }
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    deferred = null;
    notify();
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={install}>
        <Download /> {t.install}
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.installTitle}</DialogTitle>
            <DialogDescription>{t.installBody}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted/60 flex items-start gap-3 rounded-xl p-4 text-sm">
            {ios ? <Share className="text-primary mt-0.5 size-5 shrink-0" aria-hidden /> : <SquarePlus className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />}
            <p>{ios ? t.iosSteps : t.otherSteps}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setHelp(false)}>{t.gotIt}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
