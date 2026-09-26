"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { BookOpen, FileSearch, SquarePlus, Star, X } from "lucide-react";

import { useDictionary } from "@/components/internationalization/use-dictionary";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { BRAND_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android";

/** Platform detection as an external snapshot: null on the server and on
 *  desktop, "ios" / "android" on phones that are not installed and not
 *  recently dismissed. Read once per render, no state set inside effects. */
function detectPlatform(): Platform | null {
  if (typeof window === "undefined") return null;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return null;
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
  const android = /Android/i.test(ua);
  if (!ios && !android) return null;
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (at && Date.now() - at < DISMISS_DAYS * 86400_000) return null;
  } catch {
    // storage blocked — show the sheet anyway
  }
  return ios ? "ios" : "android";
}
const subscribeNoop = () => () => {};
const serverSnapshot = () => null;

/**
 * The install sheet (hogwarts src/components/offline/install-card.tsx): an iOS
 * sheet like the Activity View — rounded top over the dimmed page, grabber,
 * round close, swipe to dismiss. Inside: the app icon and name, two steps, a
 * mock of Safari's share menu (bookmark, favourites, find, Add to Home Screen
 * lit in brand green) drawn in HTML so it reads in the customer's language,
 * and a Continue that does only the native thing — the captured install
 * prompt on Android, the native share sheet on iPhone (Add to Home Screen is
 * one of its actions). Shown on phones that have not installed the app, once
 * per 14 days after a dismissal.
 */
export function InstallSheet() {
  const dict = useDictionary();
  const detected = useSyncExternalStore(
    subscribeNoop,
    detectPlatform,
    serverSnapshot,
  );
  const [hidden, setHidden] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const platform = hidden ? null : detected;

  useEffect(() => {
    if (detected !== "android") return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [detected]);

  const t = dict?.pwa;
  if (!platform || !t) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setHidden(true);
  };

  const proceed = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === "accepted") setHidden(true);
      return;
    }
    // The native share sheet straight from the tap (Web Share needs the
    // gesture); on iPhone "Add to Home Screen" is one of its actions.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: BRAND_NAME,
          url: window.location.href.split("#")[0],
        });
      } catch {
        // cancelled — nothing else to say
      }
    }
  };

  const shareRows = [
    { icon: BookOpen, label: t.shareMenu.bookmark },
    { icon: Star, label: t.shareMenu.favorites },
    { icon: FileSearch, label: t.shareMenu.find },
    { icon: SquarePlus, label: t.shareMenu.home, lit: true },
  ];

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DrawerContent
        aria-label={t.installTitle}
        className="h-[90dvh]! max-h-[92dvh]! rounded-t-[36px]! border-0 px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] [&>div:first-child]:mt-2 [&>div:first-child]:h-[5px] [&>div:first-child]:w-9 [&>div:first-child]:bg-black/30"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismiss}
          className="absolute end-4 top-4 grid size-[30px] place-items-center rounded-full bg-black/[0.06] text-foreground/70 dark:bg-white/10"
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-8">
          <div className="flex items-center gap-3">
            <Image
              src="/apple-touch-icon.png"
              alt=""
              width={180}
              height={180}
              className="size-[60px] shrink-0 rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
              priority
            />
            <div className="min-w-0 text-start">
              <DrawerTitle className="pe-10 text-[24px] leading-tight font-bold tracking-tight">
                {BRAND_NAME}
              </DrawerTitle>
              <p className="mt-0.5 text-[min(14px,3.6vw)] leading-snug text-muted-foreground">
                {t.appDesc}
              </p>
            </div>
          </div>

          <DrawerDescription
            asChild
            className="ms-0 mt-6 mb-0 list-none space-y-3 text-start text-[16px] leading-snug text-foreground [&>li]:mt-0"
          >
            <ol>
              {[t.step1, t.step2].map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[14px] font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </DrawerDescription>

          {/* Safari's share menu with "Add to Home Screen" lit up. */}
          <div aria-hidden className="mt-5 rounded-[22px] bg-muted px-4 py-2">
            {shareRows.map(({ icon: Icon, label, lit }, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-2 py-3 text-[17px]",
                  i > 0 && !lit && "border-t border-black/10",
                  lit &&
                    "-mx-1 mt-1 rounded-xl bg-background px-3 ring-2 ring-brand",
                )}
              >
                <Icon className="size-6 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>

          <div className="min-h-5 flex-1" />
          <Button
            onClick={proceed}
            className="h-14 w-full shrink-0 rounded-full bg-foreground text-[17px] font-semibold text-background hover:bg-foreground/90"
          >
            {t.continue}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
