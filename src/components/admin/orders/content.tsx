import Link from "next/link"

import { Price } from "@/components/atom/price"
import { localeConfig, type Locale } from "@/components/internationalization/config"
import type { Dictionary } from "@/components/internationalization/dictionaries"
import { interpolate } from "@/components/internationalization/interpolate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TIME_ZONE } from "@/lib/site"

import { PAGE_SIZE, type OrderFilters, type searchOrders } from "./queries"

/** Order history — server-rendered table with a plain GET filter form (mkan admin tables). */
export function OrdersContent({
  lang,
  dict,
  filters,
  result,
}: {
  lang: Locale
  dict: Dictionary
  filters: OrderFilters
  result: Awaited<ReturnType<typeof searchOrders>>
}) {
  const t = dict.admin.orders
  const fmt = new Intl.DateTimeFormat(localeConfig[lang].intl, { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE })
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const pageHref = (page: number) => {
    const sp = new URLSearchParams({ ...(filters.q && { q: filters.q }), ...(filters.status && { status: filters.status }), ...(filters.from && { from: filters.from }), ...(filters.to && { to: filters.to }), page: String(page) })
    return `/${lang}/admin/orders?${sp}`
  }

  return (
    <main id="main-content" className="space-y-4">
      <h1 className="text-2xl font-extrabold sm:text-2xl lg:text-3xl">{t.title}</h1>
      <form className="grid gap-2 rounded-2xl border bg-background p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]" method="get">
        <Input name="q" defaultValue={filters.q} placeholder={t.search} aria-label={t.search} />
        <select name="status" defaultValue={filters.status} aria-label={t.status} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">{t.allStatuses}</option>
          {(Object.keys(dict.enums.orderStatus) as (keyof typeof dict.enums.orderStatus)[]).map((s) => (
            <option key={s} value={s}>
              {dict.enums.orderStatus[s]}
            </option>
          ))}
        </select>
        <Input type="date" name="from" defaultValue={filters.from} aria-label={t.from} dir="ltr" />
        <Input type="date" name="to" defaultValue={filters.to} aria-label={t.to} dir="ltr" />
        <Button type="submit" variant="black">
          {t.filter}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t.number}</TableHead>
              <TableHead className="text-start">{t.date}</TableHead>
              <TableHead className="text-start">{t.customer}</TableHead>
              <TableHead className="text-start">{t.status}</TableHead>
              <TableHead className="text-start">{t.payment}</TableHead>
              <TableHead className="text-end">{t.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  {t.noOrders}
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/${lang}/admin/orders/${o.id}`} className="font-semibold tabular-nums underline-offset-2 hover:underline">
                      {/* i18n-exempt — order number token */}#{o.number}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{fmt.format(o.createdAt)}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell>{dict.enums.orderStatus[o.status]}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.payment ? `${dict.enums.paymentMethod[o.payment.method]} · ${dict.enums.paymentStatus[o.payment.status]}` : "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    <Price amount={o.total} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3">
          <Button asChild={filters.page > 1} variant="outline" disabled={filters.page <= 1} className="rounded-full">
            {filters.page > 1 ? <Link href={pageHref(filters.page - 1)}>{t.previous}</Link> : <span>{t.previous}</span>}
          </Button>
          <span className="text-sm">{interpolate(t.page, { page: `${filters.page} / ${pages}` })}</span>
          <Button asChild={filters.page < pages} variant="outline" disabled={filters.page >= pages} className="rounded-full">
            {filters.page < pages ? <Link href={pageHref(filters.page + 1)}>{t.next}</Link> : <span>{t.next}</span>}
          </Button>
        </nav>
      )}
    </main>
  )
}
