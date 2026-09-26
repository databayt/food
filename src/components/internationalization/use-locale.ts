"use client";

import { usePathname, useParams } from "next/navigation";
import { localeConfig, switchLocalePath, toLocale, type Locale } from "./config";

export function useSwitchLocaleHref() {
  const pathname = usePathname() ?? "/";

  return function switchLocaleHref(targetLocale: Locale): string {
    return switchLocalePath(pathname, targetLocale);
  };
}

export function useLocale() {
  const params = useParams();
  const locale = toLocale(params?.lang as string | undefined);

  return {
    locale,
    isRTL: localeConfig[locale].dir === "rtl",
    localeConfig: localeConfig[locale],
  };
}
