"use client";

import Link from "next/link";
import { Check, Globe } from "lucide-react";

import { useSwitchLocaleHref, useLocale } from "@/components/internationalization/use-locale";
import { i18n, localeConfig } from "@/components/internationalization/config";
import { useDictionary } from "@/components/internationalization/use-dictionary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "dropdown" | "inline";
}

/**
 * Locale switcher for 3+ locales (mkan's dropdown + inline variants; the
 * two-locale toggle variants are intentionally not ported).
 */
export function LanguageSwitcher({ className, variant = "dropdown" }: LanguageSwitcherProps) {
  const getSwitchLocaleHref = useSwitchLocaleHref();
  const { locale: currentLocale, isRTL } = useLocale();
  const dict = useDictionary();

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {i18n.locales.map((locale) => {
          const isActive = locale === currentLocale;
          return (
            <Link
              key={locale}
              href={getSwitchLocaleHref(locale)}
              lang={locale}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                isActive ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
              )}
            >
              {localeConfig[locale].nativeName}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-9 gap-1.5 rounded-full px-3", className)}
          data-testid="language-switcher"
        >
          <Globe className="size-4" />
          <span className="text-sm font-medium" lang={currentLocale}>
            {localeConfig[currentLocale].nativeName}
          </span>
          <span className="sr-only">{dict?.common?.switchLanguage ?? "Switch language"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRTL ? "start" : "end"}>
        {i18n.locales.map((locale) => {
          const isActive = locale === currentLocale;
          return (
            <DropdownMenuItem key={locale} asChild>
              <Link
                href={getSwitchLocaleHref(locale)}
                lang={locale}
                className={cn("flex w-full items-center gap-2", isActive && "bg-muted")}
              >
                <span>{localeConfig[locale].nativeName}</span>
                {isActive && <Check className="ms-auto size-4" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
