"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ArrowRight, Bike, Loader2, LocateFixed, MapPin, Store, Banknote, Smartphone, X } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { BagGlyph } from "@/components/atom/icons"
import { Price, Priced } from "@/components/atom/price"
import type { Locale } from "@/components/internationalization/config"
import { interpolate } from "@/components/internationalization/interpolate"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import { useLocale } from "@/components/internationalization/use-locale"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { RestaurantSettings } from "@/components/restaurant/queries"
import { mapsUrl, type DeliveryPin } from "@/lib/order/location"
import { cn } from "@/lib/utils"

import { CartLines } from "../cart/cart-lines"
import { getRememberedCustomer, rememberCustomer, rememberOrder } from "../cart/history"
import { useCart, useCartHydrated } from "../cart/use-cart"
import { cartSignature, cartSubtotal, indexMenu, resolveCart } from "../cart/util"
import type { MenuView } from "../menu/types"
import { createOrder } from "./actions"
import { clearCheckoutKey, getCheckoutKey } from "./idempotency"
import { CheckoutFormSchema, type CheckoutFormValues } from "./validation"

type Settings = Pick<
  RestaurantSettings,
  "isOpen" | "pickupEnabled" | "deliveryEnabled" | "deliveryFee" | "cashEnabled" | "momoEnabled" | "momoCode"
> & {
  /** MTN Request-to-Pay is live: the guest gets a PIN prompt on their phone. */
  momoApi: boolean
}

export function CheckoutForm({ lang, menu, settings }: { lang: Locale; menu: MenuView; settings: Settings }) {
  const dict = useDictionary()
  const router = useRouter()
  const { isRTL } = useLocale()
  const hydrated = useCartHydrated()
  const lines = useCart((s) => s.lines)
  const clearCart = useCart((s) => s.clear)
  const items = useMemo(() => indexMenu(menu), [menu])
  const resolved = resolveCart(lines, items)
  const subtotal = cartSubtotal(resolved)
  const [pending, startTransition] = useTransition()
  const [placed, setPlaced] = useState(false)
  const [location, setLocation] = useState<DeliveryPin | null>(null)
  const [showMomoNumber, setShowMomoNumber] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const Back = isRTL ? ArrowRight : ArrowLeft
  const errorText = (code?: string) => (code ? ((dict?.errors as Record<string, string> | undefined)?.[code] ?? code) : undefined)

  const fulfillments = (["PICKUP", "DELIVERY"] as const).filter((f) => (f === "PICKUP" ? settings.pickupEnabled : settings.deliveryEnabled))
  const methods = (["CASH", "MOMO"] as const).filter((m) => (m === "CASH" ? settings.cashEnabled : settings.momoEnabled))
  // Push-to-pay is the fastest way to a paid order, so it leads when it's live.
  const defaultMethod = settings.momoApi && methods.includes("MOMO") ? "MOMO" : (methods[0] ?? "CASH")

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(CheckoutFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      fulfillment: fulfillments[0] ?? "PICKUP",
      address: "",
      paymentMethod: defaultMethod,
      momoPhone: "",
      note: "",
    },
  })

  // Prefill from this device (no account needed).
  useEffect(() => {
    const c = getRememberedCustomer()
    if (!c) return
    form.setValue("name", c.name)
    form.setValue("phone", c.phone)
    if (c.address) form.setValue("address", c.address)
    if (c.fulfillment && fulfillments.includes(c.fulfillment)) form.setValue("fulfillment", c.fulfillment)
    if (c.paymentMethod && methods.includes(c.paymentMethod)) form.setValue("paymentMethod", c.paymentMethod)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fulfillment = useWatch({ control: form.control, name: "fulfillment" })
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" })
  const deliveryFee = fulfillment === "DELIVERY" ? settings.deliveryFee : 0
  const total = subtotal + deliveryFee
  // Pay-then-place: the button sends the PIN prompt; the order is placed once paid.
  const pushToPay = paymentMethod === "MOMO" && settings.momoApi
  const hasBlocking = resolved.some((r) => r.unavailable)

  const onSubmit = (values: CheckoutFormValues) => {
    if (hasBlocking) {
      toast.error(errorText("ITEM_UNAVAILABLE"))
      return
    }
    // A different payment or fulfillment is a different order, not a retry.
    const idempotencyKey = getCheckoutKey(`${cartSignature(lines)}|${values.paymentMethod}|${values.fulfillment}`)
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof createOrder>>
      try {
        res = await createOrder({
          idempotencyKey,
          locale: lang,
          ...values,
          momoPhone: pushToPay ? values.momoPhone.trim() : "",
          location: values.fulfillment === "DELIVERY" ? location : null,
          lines: lines.map(({ itemId, optionIds, quantity, note }) => ({ itemId, optionIds, quantity, note })),
        })
      } catch {
        // Network or server crash: keep the key so a retry can't duplicate.
        toast.error(errorText("NETWORK"))
        return
      }
      if (!res.success) {
        if (res.errors) {
          for (const [field, code] of Object.entries(res.errors)) {
            if (field in values) form.setError(field as keyof CheckoutFormValues, { message: code })
          }
          if (res.errors.momoPhone) setShowMomoNumber(true)
        }
        toast.error(errorText(res.error) ?? errorText("GENERIC"))
        // Fresh menu rows mark the sold-out lines right here in the list.
        if (res.error === "ITEM_UNAVAILABLE" || res.error === "INVALID_MODIFIER") router.refresh()
        return
      }
      setPlaced(true)
      rememberOrder({
        token: res.data.token,
        number: res.data.number,
        createdAt: new Date().toISOString(),
        lines: lines.map(({ itemId, optionIds, quantity, note }) => ({ itemId, optionIds, quantity, note })),
      })
      rememberCustomer({
        name: values.name.trim(),
        phone: values.phone.trim(),
        fulfillment: values.fulfillment,
        paymentMethod: values.paymentMethod,
        address: values.address.trim() || undefined,
      })
      clearCheckoutKey()
      clearCart()
      // MoMo: the PIN prompt is already on the phone; the tracking page waits
      // for MTN and turns into the live order the moment it's paid.
      router.replace(`/${lang}/track/${res.data.token}?new=1`)
    })
  }

  const canSubmit = settings.isOpen && fulfillments.length > 0 && methods.length > 0

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pb-40 pt-4">
      <Button asChild variant="ghost" size="sm" className="-ms-2 mb-2 px-2">
        <Link href={`/${lang}/order`}>
          <Back />
          {dict?.common?.backToMenu ?? "Back to menu"}
        </Link>
      </Button>
      <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-3xl">{dict?.checkout?.title ?? "Checkout"}</h1>

      {!hydrated || placed ? (
        <div className="mt-6 space-y-4" aria-busy="true">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center" data-testid="cart-empty">
          <div className="mb-6 grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
            <BagGlyph size={32} />
          </div>
          <h2 className="mb-2 text-xl font-semibold sm:text-xl lg:text-xl">{dict?.cart?.empty ?? "Your order is empty"}</h2>
          <p className="mb-6">{dict?.cart?.emptyHint ?? "Add something tasty from the menu."}</p>
          <Button asChild variant="black" className="h-11 rounded-full px-6">
            <Link href={`/${lang}/order`}>{dict?.cart?.browseMenu ?? "Browse the menu"}</Link>
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-8" noValidate>
            <section aria-labelledby="your-order">
              <h2 id="your-order" className="sr-only">
                {dict?.cart?.title ?? "Your order"}
              </h2>
              <CartLines resolved={resolved} />
              {hasBlocking && <p className="mt-1 text-sm text-destructive">{dict?.errors?.ITEM_UNAVAILABLE}</p>}
              <Button asChild variant="outline" className="mt-2 w-full rounded-full">
                <Link href={`/${lang}/order`}>{dict?.cart?.addMore ?? "Add more items"}</Link>
              </Button>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold sm:text-lg lg:text-lg">{dict?.checkout?.yourDetails ?? "Your details"}</h2>
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{dict?.checkout?.name ?? "Name"}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="name" className="h-12 text-base" placeholder={dict?.checkout?.namePlaceholder ?? "Your name"} />
                    </FormControl>
                    <FormMessage>{errorText(fieldState.error?.message)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{dict?.checkout?.phone ?? "Phone number"}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        dir="ltr"
                        className="h-12 text-base"
                        placeholder={dict?.checkout?.phonePlaceholder ?? "078 123 4567"}
                      />
                    </FormControl>
                    {fieldState.error ? (
                      <FormMessage>{errorText(fieldState.error.message)}</FormMessage>
                    ) : (
                      <p className="text-xs">{dict?.checkout?.phoneHint}</p>
                    )}
                  </FormItem>
                )}
              />
            </section>

            {fulfillments.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold sm:text-lg lg:text-lg">{dict?.checkout?.fulfillment ?? "How do you want it?"}</h2>
                <ChoiceGroup
                  name="fulfillment"
                  value={fulfillment}
                  onChange={(v) => form.setValue("fulfillment", v as CheckoutFormValues["fulfillment"], { shouldValidate: form.formState.isSubmitted })}
                  options={fulfillments.map((f) => ({
                    value: f,
                    label: dict?.enums?.fulfillment?.[f] ?? f,
                    hint: f === "PICKUP" ? dict?.checkout?.pickupHint : dict?.checkout?.deliveryHint,
                    icon: f === "PICKUP" ? <Store className="size-5" /> : <Bike className="size-5" />,
                  }))}
                />
                {fulfillment === "DELIVERY" && (
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>{dict?.checkout?.address ?? "Delivery address"}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            autoComplete="street-address"
                            className="text-base"
                            placeholder={dict?.checkout?.addressPlaceholder ?? "Street, building, landmark"}
                          />
                        </FormControl>
                        <FormMessage>{errorText(fieldState.error?.message)}</FormMessage>
                      </FormItem>
                    )}
                  />
                )}
                {fulfillment === "DELIVERY" && <LocationPicker value={location} onChange={setLocation} />}
              </section>
            )}

            {methods.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold sm:text-lg lg:text-lg">{dict?.checkout?.payment ?? "Payment"}</h2>
                <ChoiceGroup
                  name="paymentMethod"
                  value={paymentMethod}
                  onChange={(v) => form.setValue("paymentMethod", v as CheckoutFormValues["paymentMethod"])}
                  options={methods.map((m) => ({
                    value: m,
                    label: dict?.enums?.paymentMethod?.[m] ?? m,
                    hint:
                      m === "CASH"
                        ? dict?.checkout?.cashHint
                        : settings.momoApi
                          ? dict?.checkout?.momoPayHint
                          : settings.momoCode
                          ? interpolate(dict?.checkout?.momoHint, { code: settings.momoCode })
                          : undefined,
                    icon: m === "CASH" ? <Banknote className="size-5" /> : <Smartphone className="size-5" />,
                  }))}
                />
                {pushToPay &&
                  (showMomoNumber ? (
                    <FormField
                      control={form.control}
                      name="momoPhone"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel>{dict?.checkout?.momoNumber ?? "MoMo number"}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="tel"
                              inputMode="tel"
                              dir="ltr"
                              maxLength={20}
                              className="h-12 text-base"
                              placeholder={dict?.checkout?.phonePlaceholder ?? "078 123 4567"}
                              data-testid="momo-phone"
                            />
                          </FormControl>
                          {fieldState.error ? (
                            <FormMessage>{errorText(fieldState.error.message)}</FormMessage>
                          ) : (
                            <p className="text-xs">{dict?.checkout?.momoNumberHint}</p>
                          )}
                        </FormItem>
                      )}
                    />
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-medium underline underline-offset-2"
                      onClick={() => setShowMomoNumber(true)}
                      data-testid="momo-other-number"
                    >
                      {dict?.checkout?.momoOtherNumber ?? "Pay from another MoMo number"}
                    </button>
                  ))}
              </section>
            )}

            {showNote || form.getValues("note") ? (
              <FormField
                control={form.control}
                name="note"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>
                      {dict?.checkout?.orderNote ?? "Note for the kitchen"}{" "}
                      <span className="font-normal text-muted-foreground">({dict?.common?.optional ?? "Optional"})</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} maxLength={280} autoFocus={showNote} className="text-base" placeholder={dict?.checkout?.orderNotePlaceholder} />
                    </FormControl>
                    <FormMessage>{errorText(fieldState.error?.message)}</FormMessage>
                  </FormItem>
                )}
              />
            ) : (
              <button type="button" className="text-sm font-medium underline underline-offset-2" onClick={() => setShowNote(true)} data-testid="add-note">
                {dict?.checkout?.addNote ?? "Add a note for the kitchen"}
              </button>
            )}

            <section className="rounded-2xl border p-4">
              <h2 className="sr-only">{dict?.checkout?.summary ?? "Order summary"}</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt>{dict?.cart?.subtotal ?? "Subtotal"}</dt>
                  <dd>
                    <Price amount={subtotal} />
                  </dd>
                </div>
                {fulfillment === "DELIVERY" &&
                  (settings.deliveryFee > 0 ? (
                    <div className="flex justify-between">
                      <dt>{dict?.cart?.deliveryFee ?? "Delivery fee"}</dt>
                      <dd>
                        <Price amount={settings.deliveryFee} />
                      </dd>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{dict?.checkout?.deliveryFeeTbc}</p>
                  ))}
                <div className="flex justify-between text-base font-bold text-foreground">
                  <dt>{dict?.cart?.total ?? "Total"}</dt>
                  <dd data-testid="checkout-total">
                    <Price amount={total} />
                  </dd>
                </div>
              </dl>
            </section>

            <p className="text-xs">{dict?.checkout?.remembered}</p>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {canSubmit ? (
                <Button
                  type="submit"
                  size="lg"
                  disabled={pending || hasBlocking}
                  className="mx-auto flex h-12 w-full max-w-lg rounded-full text-base"
                  data-testid="place-order"
                  data-push-to-pay={pushToPay || undefined}
                >
                  {pending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {pushToPay ? (dict?.checkout?.sendingPrompt ?? "Sending the PIN prompt…") : (dict?.checkout?.placing ?? "Placing your order…")}
                    </>
                  ) : pushToPay ? (
                    <>
                      <Smartphone />
                      <Priced template={(dict?.checkout?.payWithMomo ?? "Pay {total} with MoMo").replace("{total}", "{price}")} amount={total} />
                    </>
                  ) : (
                    <Priced template={(dict?.checkout?.placeOrder ?? "Place order · {total}").replace("{total}", "{price}")} amount={total} />
                  )}
                </Button>
              ) : (
                <p className="mx-auto max-w-lg text-center text-sm font-medium">
                  {settings.isOpen ? dict?.checkout?.noMethods : dict?.checkout?.closed}
                </p>
              )}
            </div>
          </form>
        </Form>
      )}
    </main>
  )
}

/**
 * Optional delivery pin. Kigali street addresses often aren't enough for a
 * rider, so the guest can attach their current position; the cashier opens
 * it in Google Maps. The typed address stays required.
 */
function LocationPicker({ value, onChange }: { value: DeliveryPin | null; onChange: (pin: DeliveryPin | null) => void }) {
  const dict = useDictionary()
  const t = dict?.checkout
  const [state, setState] = useState<"idle" | "locating" | "error">("idle")

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setState("error")
      return
    }
    setState("locating")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({ lat: coords.latitude, lng: coords.longitude, accuracy: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null })
        setState("idle")
      },
      () => setState("error"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    )
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-600/40 bg-emerald-50 p-3 text-emerald-900" data-testid="location-attached">
        <MapPin className="size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-900">
            {value.accuracy != null
              ? interpolate(t?.locationAttached ?? "Location attached (±{meters} m)", { meters: value.accuracy })
              : (t?.locationAttachedPlain ?? "Location attached")}
          </p>
          <a
            href={mapsUrl(value.lat, value.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-800 underline underline-offset-2"
          >
            {t?.viewOnMap ?? "Check on map"}
          </a>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={() => onChange(null)}>
          <X />
          {t?.removeLocation ?? "Remove"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-xl text-base"
        onClick={locate}
        disabled={state === "locating"}
        data-testid="share-location"
      >
        {state === "locating" ? <Loader2 className="animate-spin" /> : <LocateFixed />}
        {state === "locating" ? (t?.locating ?? "Finding your location…") : (t?.shareLocation ?? "Share my location")}
      </Button>
      <p className={cn("text-xs", state === "error" && "font-medium text-destructive")} role={state === "error" ? "alert" : undefined}>
        {state === "error" ? t?.locationError : t?.locationHint}
      </p>
    </div>
  )
}

function ChoiceGroup({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; hint?: string; icon: React.ReactNode }[]
}) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const checked = value === o.value
        return (
          <label
            key={o.value}
            className={cn(
              "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              checked ? "border-foreground bg-muted/60 ring-1 ring-foreground" : "hover:bg-muted/40"
            )}
            data-testid={`${name}-${o.value}`}
          >
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="mt-0.5 text-foreground">{o.icon}</span>
            <span className="flex-1">
              <span className="block font-semibold text-foreground">{o.label}</span>
              {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}
