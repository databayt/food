"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Banknote, Bike, Check, Loader2, Minus, Plus, Printer, Smartphone, SlidersHorizontal, Store, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { BagGlyph } from "@/components/atom/icons"
import { Price, Priced } from "@/components/atom/price"
import type { Locale } from "@/components/internationalization/config"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { cartCount, cartSubtotal, indexMenu, resolveCart } from "@/components/order/cart/util"
import { ItemSheet } from "@/components/order/menu/item-sheet"
import type { MenuItemView, MenuView } from "@/components/order/menu/types"
import { startMomoPayment } from "@/components/order/payment/actions"
import { playChime } from "@/components/staff/sound"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useNow } from "@/hooks/use-now"
import { useVisiblePoll } from "@/hooks/use-visible-poll"
import type { ActionResponse } from "@/lib/action-response"
import { formatLocalPhone } from "@/lib/order/phone"
import { MAX_QUANTITY } from "@/lib/order/pricing"
import { cn } from "@/lib/utils"

import { createPosOrder, fetchPosPayment, posCancelPayment, posTakeCash } from "./actions"
import { Receipt } from "./receipt"
import type { PosResult } from "./types"
import { useTicket, useTicketHydrated } from "./use-ticket"

export type PosSettings = {
  deliveryEnabled: boolean
  deliveryFee: number
  /** MTN Request-to-Pay is live: the counter can push a PIN prompt. */
  momo: boolean
  restaurant: { name: string; address: string | null; phone: string | null }
}

type Method = "CASH" | "MOMO"
type Phase = { kind: "ticket" } | { kind: "momo"; result: PosResult; phone: string } | { kind: "done"; result: PosResult }

const MOMO_POLL_MS = 3_000
/** Counter quick-cash buttons, in francs. */
const NOTES = [2_000, 5_000, 10_000, 20_000]
/** After this, offer "send again" while a prompt is still out. */
const RESEND_AFTER_MS = 45_000

/**
 * Counter POS — ring up a walk-in or a phone order in a few taps: items →
 * ticket → cash (tender + change) or MoMo (PIN prompt to the payer's phone,
 * placed automatically once MTN confirms). Tablet: menu and ticket side by
 * side; phone: the ticket opens from a bottom bar.
 */
export function PosContent({ lang, menu, settings }: { lang: Locale; menu: MenuView; settings: PosSettings }) {
  const dict = useDictionary()
  const t = dict?.pos
  const router = useRouter()
  const hydrated = useTicketHydrated()
  const ticket = useTicket()
  const items = useMemo(() => indexMenu(menu), [menu])
  const resolved = resolveCart(ticket.lines, items)
  const isDelivery = ticket.fulfillment === "DELIVERY"
  const total = cartSubtotal(resolved) + (isDelivery ? settings.deliveryFee : 0)
  const count = cartCount(ticket.lines)
  const hasBlocking = resolved.some((r) => r.unavailable)

  const [categoryId, setCategoryId] = useState(menu.categories[0]?.id ?? "")
  const [sheetItem, setSheetItem] = useState<MenuItemView | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [method, setMethod] = useState<Method>("CASH")
  const [cash, setCash] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [phase, setPhase] = useState<Phase>({ kind: "ticket" })
  const [pending, startTransition] = useTransition()
  const errorText = (code?: string) => (code ? ((dict?.errors as Record<string, string> | undefined)?.[code] ?? code) : undefined)

  const cashNow = method === "CASH" && !isDelivery
  const tendered = cash === "" ? 0 : Number(cash)
  const change = tendered - total
  const canCharge = hydrated && count > 0 && !hasBlocking && !pending && (!cashNow || tendered >= total)
  const category = menu.categories.find((c) => c.id === categoryId) ?? menu.categories[0]

  const openSheet = (item: MenuItemView) => {
    setSheetItem(item)
    setSheetOpen(true)
  }
  /** One tap adds a plain item; a required choice (e.g. which drink) opens the sheet. */
  const tap = (item: MenuItemView) => {
    if (!item.isAvailable) return
    if (item.modifierGroups.some((g) => g.minSelect > 0)) return openSheet(item)
    ticket.add({ itemId: item.id, optionIds: [], quantity: 1, note: "" })
    toast.success(interpolate(t?.added ?? "Added {name}", { name: item.name }), { duration: 1200 })
  }

  const settle = (result: PosResult) => {
    if (result.status === "AWAITING_PAYMENT") {
      setPhase({ kind: "momo", result, phone: ticket.phone })
      return
    }
    if (result.status === "CANCELLED") {
      // Expired or dropped while waiting: the ticket is still here to retry.
      ticket.dropChargeKey()
      setPhase({ kind: "ticket" })
      toast.error(dict?.track?.statusHint?.UNPAID)
      return
    }
    setPhase({ kind: "done", result })
    setTicketOpen(false)
    ticket.clear()
    setCash("")
    setMethod("CASH")
    setErrors({})
  }

  const handle = (res: ActionResponse<PosResult>) => {
    if (res.success) return settle(res.data)
    setErrors(res.errors ?? {})
    toast.error(errorText(res.error) ?? errorText("GENERIC"))
    if (res.error === "ITEM_UNAVAILABLE" || res.error === "INVALID_MODIFIER") router.refresh()
  }

  const charge = () =>
    startTransition(async () => {
      setErrors({})
      try {
        handle(
          await createPosOrder({
            idempotencyKey: ticket.takeChargeKey(),
            locale: lang,
            lines: ticket.lines.map(({ itemId, optionIds, quantity, note }) => ({ itemId, optionIds, quantity, note })),
            fulfillment: ticket.fulfillment,
            name: ticket.name,
            phone: ticket.phone,
            address: ticket.address,
            note: ticket.note,
            method,
            tendered: cashNow ? tendered : undefined,
          })
        )
      } catch {
        // The key is kept, so a retry can't ring the ticket up twice.
        toast.error(errorText("NETWORK"))
      }
    })

  const chargeLabel = cashNow
    ? (t?.charge ?? "Charge {total}")
    : method === "MOMO"
      ? (t?.sendPrompt ?? "Send PIN prompt · {total}")
      : (t?.codCharge ?? "Send to kitchen · {total} on delivery")

  const ticketPanel = (
    <TicketPanel
      settings={settings}
      method={method}
      setMethod={setMethod}
      cash={cash}
      setCash={setCash}
      errors={errors}
      total={total}
      change={change}
      cashNow={cashNow}
      resolved={resolved}
      hasBlocking={hasBlocking}
      onEnter={() => canCharge && charge()}
      footer={
        <Button
          type="button"
          size="lg"
          className="h-14 w-full rounded-2xl text-base"
          disabled={!canCharge}
          onClick={charge}
          data-testid="pos-charge"
        >
          {pending ? <Loader2 className="animate-spin" /> : method === "MOMO" ? <Smartphone /> : <Banknote />}
          <Priced template={chargeLabel.replace("{total}", "{price}")} amount={total} />
        </Button>
      }
    />
  )

  if (phase.kind === "momo") {
    return (
      <main id="main-content" className="mx-auto max-w-lg px-4 py-6">
        <MomoWait
          lang={lang}
          phase={phase}
          onUpdate={(result) => (result.status === "AWAITING_PAYMENT" ? setPhase({ ...phase, result }) : settle(result))}
          onCancelled={() => {
            ticket.dropChargeKey()
            setPhase({ kind: "ticket" })
          }}
        />
      </main>
    )
  }

  if (phase.kind === "done") {
    return (
      <main id="main-content" className="mx-auto max-w-lg px-4 py-6">
        <Done lang={lang} result={phase.result} restaurant={settings.restaurant} onNext={() => setPhase({ kind: "ticket" })} />
      </main>
    )
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 pb-28 pt-4 lg:pb-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label={t?.title ?? "New order"} className="min-w-0">
          <div role="tablist" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {menu.categories.map((c) => (
              <button
                key={c.id}
                role="tab"
                type="button"
                aria-selected={c.id === category?.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium",
                  c.id === category?.id ? "border-foreground bg-foreground text-background" : "bg-background"
                )}
                data-testid={`pos-category-${c.slug}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {category?.items.map((item) => (
              <li key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => tap(item)}
                  disabled={!item.isAvailable}
                  className="flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-start shadow-xs transition-transform active:scale-[0.98] disabled:opacity-50"
                  data-pos-item={item.slug}
                >
                  <span className="relative block aspect-[4/3] w-full bg-muted/60">
                    {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="(min-width: 1024px) 200px, 45vw" className="object-contain p-2" />}
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5 p-2.5">
                    <span className="line-clamp-2 text-sm font-semibold text-foreground">{item.name}</span>
                    {item.isAvailable ? (
                      <Price amount={item.price} className="text-sm" />
                    ) : (
                      <span className="text-sm font-medium text-destructive">{dict?.order?.soldOut ?? "Sold out"}</span>
                    )}
                  </span>
                </button>
                {item.isAvailable && item.modifierGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openSheet(item)}
                    className="absolute end-1.5 top-1.5 grid size-9 place-items-center rounded-full border bg-background/90 shadow-xs"
                    aria-label={`${t?.options ?? "Options"} · ${item.name}`}
                    data-testid="pos-item-options"
                  >
                    <SlidersHorizontal className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-18 max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl border bg-background p-4">{ticketPanel}</div>
        </aside>
      </div>

      {/* Phones: the ticket rides in a bottom bar and opens as a sheet. */}
      <div className="fixed inset-x-0 bottom-16 z-30 px-4 pb-2 md:bottom-0 md:pb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setTicketOpen(true)}
          disabled={count === 0}
          className="mx-auto flex h-14 w-full max-w-lg items-center gap-3 rounded-full bg-primary px-5 text-primary-foreground shadow-lg disabled:opacity-60"
          data-testid="pos-ticket-bar"
        >
          <BagGlyph size={22} />
          <span className="flex-1 text-start font-semibold">{interpolate(t?.viewTicket ?? "Ticket · {count}", { count })}</span>
          <Price amount={total} className="font-semibold" />
        </button>
      </div>
      <Sheet open={ticketOpen} onOpenChange={setTicketOpen}>
        <SheetContent side="bottom" className="mx-auto h-[92dvh] max-w-lg gap-0 rounded-t-[2rem] p-0 lg:hidden">
          {/* The panel carries its own visible "Ticket" heading. */}
          <SheetHeader className="sr-only">
            <SheetTitle>{t?.ticket ?? "Ticket"}</SheetTitle>
            <SheetDescription>{t?.title}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-10">{ticketPanel}</div>
        </SheetContent>
      </Sheet>

      <ItemSheet
        item={sheetItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onAdd={(line) => {
          ticket.add(line)
          if (sheetItem) toast.success(interpolate(t?.added ?? "Added {name}", { name: sheetItem.name }), { duration: 1200 })
        }}
      />
    </main>
  )
}

function TicketPanel({
  settings,
  method,
  setMethod,
  cash,
  setCash,
  errors,
  total,
  change,
  cashNow,
  resolved,
  hasBlocking,
  onEnter,
  footer,
}: {
  settings: PosSettings
  method: Method
  setMethod: (m: Method) => void
  cash: string
  setCash: (v: string) => void
  errors: Record<string, string>
  total: number
  change: number
  cashNow: boolean
  resolved: ReturnType<typeof resolveCart>
  hasBlocking: boolean
  /** Enter in the cash field charges — the counter keeps its hands on the keypad. */
  onEnter: () => void
  footer: React.ReactNode
}) {
  const dict = useDictionary()
  const t = dict?.pos
  const ticket = useTicket()
  const isDelivery = ticket.fulfillment === "DELIVERY"
  const errorText = (code?: string) => (code ? ((dict?.errors as Record<string, string> | undefined)?.[code] ?? code) : undefined)

  return (
    <div className="space-y-4" data-testid="pos-ticket">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold sm:text-lg lg:text-lg">{t?.ticket ?? "Ticket"}</h2>
        {ticket.lines.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => ticket.clear()} data-testid="pos-clear">
            <X />
            {t?.clear ?? "Clear"}
          </Button>
        )}
      </div>

      {resolved.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-8 text-center text-sm">{t?.empty ?? "Tap an item to add it."}</p>
      ) : (
        <ul className="divide-y">
          {resolved.map(({ line, item, options, lineTotal, unavailable }) => (
            <li key={line.key} className={cn("flex items-center gap-2 py-2", unavailable && "opacity-60")} data-testid="pos-line">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  <bdi>{item?.name ?? "—"}</bdi>
                </p>
                {options.length > 0 && <p className="truncate text-xs">+ {options.map((o) => o.name).join(", ")}</p>}
                {line.note && <p className="truncate text-xs italic">{line.note}</p>}
                {unavailable && <p className="text-xs font-medium text-destructive">{dict?.order?.soldOut ?? "Sold out"}</p>}
              </div>
              <div className="flex items-center rounded-full border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full px-0"
                  onClick={() => (line.quantity <= 1 ? ticket.remove(line.key) : ticket.setQuantity(line.key, line.quantity - 1))}
                  aria-label={line.quantity <= 1 ? (dict?.cart?.remove ?? "Remove") : (dict?.order?.decrease ?? "Decrease quantity")}
                >
                  {line.quantity <= 1 ? <Trash2 /> : <Minus />}
                </Button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full px-0"
                  disabled={line.quantity >= MAX_QUANTITY}
                  onClick={() => ticket.setQuantity(line.key, line.quantity + 1)}
                  aria-label={dict?.order?.increase ?? "Increase quantity"}
                >
                  <Plus />
                </Button>
              </div>
              <Price amount={lineTotal} className="w-20 shrink-0 text-end text-sm font-semibold text-foreground" />
            </li>
          ))}
        </ul>
      )}
      {hasBlocking && <p className="text-sm text-destructive">{dict?.errors?.ITEM_UNAVAILABLE}</p>}

      {settings.deliveryEnabled && (
        <Segmented
          value={ticket.fulfillment}
          onChange={(v) => ticket.setFulfillment(v as "PICKUP" | "DELIVERY")}
          options={[
            { value: "PICKUP", label: dict?.enums?.fulfillment?.PICKUP ?? "Pickup", icon: <Store className="size-4" /> },
            { value: "DELIVERY", label: dict?.enums?.fulfillment?.DELIVERY ?? "Delivery", icon: <Bike className="size-4" /> },
          ]}
          testId="pos-fulfillment"
        />
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field error={errorText(errors.name)}>
          <Input
            value={ticket.name}
            onChange={(e) => ticket.setField("name", e.target.value)}
            maxLength={60}
            className="h-11"
            placeholder={t?.name ?? "Name (optional)"}
            aria-label={t?.name ?? "Name (optional)"}
            data-testid="pos-name"
          />
        </Field>
        <Field error={errorText(errors.phone)}>
          <Input
            value={ticket.phone}
            onChange={(e) => ticket.setField("phone", e.target.value)}
            type="tel"
            inputMode="tel"
            dir="ltr"
            maxLength={20}
            className="h-11"
            placeholder={isDelivery || method === "MOMO" ? (t?.phone ?? "Phone") : (t?.phoneOptional ?? "Phone (optional)")}
            aria-label={t?.phone ?? "Phone"}
            data-testid="pos-phone"
          />
        </Field>
      </div>
      {isDelivery && (
        <Field error={errorText(errors.address)}>
          <Textarea
            value={ticket.address}
            onChange={(e) => ticket.setField("address", e.target.value)}
            rows={2}
            maxLength={200}
            placeholder={t?.address ?? "Delivery address"}
            aria-label={t?.address ?? "Delivery address"}
            data-testid="pos-address"
          />
        </Field>
      )}
      <Input
        value={ticket.note}
        onChange={(e) => ticket.setField("note", e.target.value)}
        maxLength={280}
        className="h-11"
        placeholder={t?.note ?? "Note for the kitchen (optional)"}
        aria-label={t?.note ?? "Note for the kitchen (optional)"}
      />

      <dl className="space-y-1 border-t pt-3 text-sm">
        {isDelivery && settings.deliveryFee > 0 && (
          <div className="flex justify-between">
            <dt>{dict?.cart?.deliveryFee}</dt>
            <dd>
              <Price amount={settings.deliveryFee} />
            </dd>
          </div>
        )}
        <div className="flex justify-between text-xl font-extrabold text-foreground">
          <dt>{dict?.cart?.total ?? "Total"}</dt>
          <dd data-testid="pos-total">
            <Price amount={total} />
          </dd>
        </div>
      </dl>

      <Segmented
        value={method}
        onChange={(v) => setMethod(v as Method)}
        options={[
          { value: "CASH", label: t?.cash ?? "Cash", icon: <Banknote className="size-4" /> },
          ...(settings.momo ? [{ value: "MOMO", label: t?.momo ?? "MoMo", icon: <Smartphone className="size-4" /> }] : []),
        ]}
        testId="pos-method"
      />

      {cashNow && (
        <div className="space-y-2">
          <Field error={errorText(errors.tendered)}>
            <label className="flex items-center gap-3 rounded-xl border px-3">
              <span className="shrink-0 text-sm font-medium">{t?.received ?? "Received"}</span>
              <input
                value={cash}
                onChange={(e) => setCash(e.target.value.replace(/\D/g, "").slice(0, 8))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onEnter()
                  }
                }}
                inputMode="numeric"
                enterKeyHint="done"
                dir="ltr"
                className="h-12 min-w-0 flex-1 bg-transparent text-end text-xl font-bold tabular-nums outline-none"
                placeholder="0"
                data-testid="pos-tendered"
              />
            </label>
          </Field>
          <div className="grid grid-cols-5 gap-1.5">
            <Button type="button" variant="outline" className="h-10 px-1 text-xs" onClick={() => setCash(String(total))} data-testid="pos-exact">
              {t?.exact ?? "Exact"}
            </Button>
            {NOTES.map((n) => (
              <Button key={n} type="button" variant="outline" className="h-10 px-1 text-xs tabular-nums" onClick={() => setCash(String(n))}>
                <Price amount={n} />
              </Button>
            ))}
          </div>
          {cash !== "" && (
            <p className={cn("text-center text-lg font-bold", change >= 0 ? "text-emerald-700" : "text-destructive")} data-testid="pos-change">
              <Priced
                template={(change >= 0 ? (t?.change ?? "Change {amount}") : (t?.short ?? "{amount} short")).replace("{amount}", "{price}")}
                amount={Math.abs(change)}
              />
            </p>
          )}
        </div>
      )}

      {footer}
    </div>
  )
}

/** Waiting for the payer's PIN. Polls MTN through the server; places itself when paid. */
function MomoWait({
  lang,
  phase,
  onUpdate,
  onCancelled,
}: {
  lang: Locale
  phase: Extract<Phase, { kind: "momo" }>
  onUpdate: (result: PosResult) => void
  onCancelled: () => void
}) {
  const dict = useDictionary()
  const t = dict?.pos
  const now = useNow(5_000)
  const [pending, startTransition] = useTransition()
  const [cash, setCash] = useState("")
  const { result } = phase
  const attempt = result.attempt
  const waiting = attempt?.status === "PENDING"
  const canResend = !waiting || now - new Date(attempt.createdAt).getTime() > RESEND_AFTER_MS
  const pickup = result.fulfillment === "PICKUP"
  const errorText = (code?: string) => (code ? ((dict?.errors as Record<string, string> | undefined)?.[code] ?? code) : undefined)

  useVisiblePoll(
    async () => {
      try {
        const res = await fetchPosPayment({ orderId: result.orderId, locale: lang })
        if (res.success) {
          if (res.data.status !== "AWAITING_PAYMENT") playChime()
          onUpdate(res.data)
        }
      } catch {
        // offline: the next tick retries
      }
    },
    MOMO_POLL_MS,
    true,
    true
  )

  const run = (action: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await action()
      } catch {
        toast.error(errorText("NETWORK"))
      }
    })

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950" data-testid="pos-momo-wait" data-attempt={attempt?.status ?? "NONE"}>
      <p className="text-sm font-medium">{interpolate(dict?.track?.title ?? "Order #{number}", { number: result.number })}</p>
      <p className="mt-1 text-3xl font-extrabold">
        <Price amount={result.total} />
      </p>
      {waiting ? (
        <div className="mt-4 flex items-start gap-3" role="status">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin" />
          <div>
            <p className="font-semibold">{interpolate(t?.waiting ?? "Waiting for the PIN on {phone}", { phone: formatLocalPhone(phase.phone) })}</p>
            <p className="text-sm text-amber-900">{t?.waitingHint}</p>
          </div>
        </div>
      ) : (
        attempt && (
          <p className="mt-4 font-medium text-destructive" role="alert">
            {(dict?.track?.momoFailed as Record<string, string> | undefined)?.[attempt.status] ?? attempt.status}
          </p>
        )
      )}

      <div className="mt-5 grid gap-2">
        {canResend && (
          <Button
            type="button"
            className="h-12 rounded-xl text-base"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await startMomoPayment({ token: result.token, phone: phase.phone })
                if (!res.success) toast.error(errorText(res.error))
              })
            }
            data-testid="pos-momo-resend"
          >
            <Smartphone />
            {t?.sendAgain ?? "Send again"}
          </Button>
        )}
        {pickup && (
          <label className="flex items-center gap-3 rounded-xl border bg-background px-3">
            <span className="shrink-0 text-sm font-medium">{t?.received ?? "Received"}</span>
            <input
              value={cash}
              onChange={(e) => setCash(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              dir="ltr"
              className="h-11 min-w-0 flex-1 bg-transparent text-end text-lg font-bold tabular-nums outline-none"
              placeholder={String(result.total)}
              data-testid="pos-momo-cash"
            />
          </label>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl bg-background text-base"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await posTakeCash({ orderId: result.orderId, locale: lang, tendered: pickup ? (cash === "" ? result.total : Number(cash)) : undefined })
              if (res.success) onUpdate(res.data)
              else toast.error(errorText(res.error))
            })
          }
          data-testid="pos-momo-cash-instead"
        >
          <Banknote />
          {t?.switchToCash ?? "Take cash instead"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-xl text-destructive"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await posCancelPayment({ orderId: result.orderId, locale: lang })
              if (res.success) onCancelled()
              else toast.error(errorText(res.error))
            })
          }
          data-testid="pos-momo-cancel"
        >
          <X />
          {t?.cancelPayment ?? "Cancel"}
        </Button>
      </div>
    </section>
  )
}

/** The order is in the kitchen: change to give back, print, next ticket. */
function Done({ lang, result, restaurant, onNext }: { lang: Locale; result: PosResult; restaurant: PosSettings["restaurant"]; onNext: () => void }) {
  const dict = useDictionary()
  const t = dict?.pos
  const paidMomo = result.payment.status === "PAID" && result.payment.method === "MOMO"
  const collect = result.payment.status !== "PAID"

  return (
    <section className="rounded-2xl border bg-background p-5 text-center" data-testid="pos-done" data-number={result.number}>
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-600 text-white">
        <Check className="size-7" />
      </span>
      <p className="mt-3 text-xl font-extrabold text-foreground">
        {interpolate(paidMomo ? (t?.paid ?? "Paid — order #{number} is in the kitchen") : (t?.placed ?? "Order #{number} is in the kitchen"), {
          number: result.number,
        })}
      </p>
      {result.change != null && result.change > 0 && (
        <p className="mt-3 text-2xl font-extrabold text-emerald-700" data-testid="pos-change-due">
          <Priced template={(t?.changeDue ?? "Give change: {amount}").replace("{amount}", "{price}")} amount={result.change} />
        </p>
      )}
      {collect && (
        <p className="mt-3 text-lg font-bold text-amber-700">
          <Priced template={(t?.collectOnDelivery ?? "Rider collects {amount}").replace("{amount}", "{price}")} amount={result.total} />
        </p>
      )}
      {result.payment.reference && (
        <p className="mt-2 text-sm" dir="ltr">
          {dict?.track?.momoReceipt} {result.payment.reference}
        </p>
      )}
      <div className="mt-6 grid gap-2">
        <Button type="button" size="lg" className="h-14 rounded-2xl text-base" onClick={onNext} autoFocus data-testid="pos-next">
          {t?.newTicket ?? "New ticket"}
        </Button>
        {result.receipt && (
          <Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={() => window.print()} data-testid="pos-print">
            <Printer />
            {t?.print ?? "Print receipt"}
          </Button>
        )}
      </div>
      <Receipt lang={lang} result={result} restaurant={restaurant} />
    </section>
  )
}

function Segmented({
  value,
  onChange,
  options,
  testId,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; icon: React.ReactNode }[]
  testId: string
}) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold",
            value === o.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
          )}
          data-testid={`${testId}-${o.value}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Field({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {children}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
