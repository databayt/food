"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, ArrowRight, Bike, Loader2, Store, Banknote, Smartphone } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { Price } from "@/components/atom/price"
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
import { formatRwf } from "@/lib/order/money"
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
>

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
  const Back = isRTL ? ArrowRight : ArrowLeft
  const errorText = (code?: string) => (code ? ((dict?.errors as Record<string, string> | undefined)?.[code] ?? code) : undefined)

  const fulfillments = (["PICKUP", "DELIVERY"] as const).filter((f) => (f === "PICKUP" ? settings.pickupEnabled : settings.deliveryEnabled))
  const methods = (["CASH", "MOMO"] as const).filter((m) => (m === "CASH" ? settings.cashEnabled : settings.momoEnabled))

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(CheckoutFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      fulfillment: fulfillments[0] ?? "PICKUP",
      address: "",
      paymentMethod: methods[0] ?? "CASH",
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

  // After a successful order the cart empties; don't flash the empty state.
  useEffect(() => {
    if (hydrated && lines.length === 0 && !placed) router.replace(`/${lang}/order/cart`)
  }, [hydrated, lines.length, placed, lang, router])

  const onSubmit = (values: CheckoutFormValues) => {
    if (resolved.some((r) => r.unavailable)) {
      toast.error(errorText("ITEM_UNAVAILABLE"))
      router.push(`/${lang}/order/cart`)
      return
    }
    const idempotencyKey = getCheckoutKey(cartSignature(lines))
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof createOrder>>
      try {
        res = await createOrder({
          idempotencyKey,
          locale: lang,
          ...values,
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
        }
        toast.error(errorText(res.error) ?? errorText("GENERIC"))
        if (res.error === "ITEM_UNAVAILABLE" || res.error === "INVALID_MODIFIER") {
          router.refresh()
          router.push(`/${lang}/order/cart`)
        }
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
      router.replace(`/${lang}/track/${res.data.token}?new=1`)
    })
  }

  const canSubmit = settings.isOpen && fulfillments.length > 0 && methods.length > 0

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pb-40 pt-4">
      <Button asChild variant="ghost" size="sm" className="-ms-2 mb-2 px-2">
        <Link href={`/${lang}/order/cart`}>
          <Back />
          {dict?.cart?.title ?? "Your order"}
        </Link>
      </Button>
      <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-3xl">{dict?.checkout?.title ?? "Checkout"}</h1>

      {!hydrated || placed ? (
        <div className="mt-6 space-y-4" aria-busy="true">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-8" noValidate>
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
                        : settings.momoCode
                          ? interpolate(dict?.checkout?.momoHint, { code: settings.momoCode })
                          : undefined,
                    icon: m === "CASH" ? <Banknote className="size-5" /> : <Smartphone className="size-5" />,
                  }))}
                />
              </section>
            )}

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
                    <Textarea {...field} rows={2} maxLength={280} className="text-base" placeholder={dict?.checkout?.orderNotePlaceholder} />
                  </FormControl>
                  <FormMessage>{errorText(fieldState.error?.message)}</FormMessage>
                </FormItem>
              )}
            />

            <section className="rounded-2xl border p-4">
              <h2 className="text-lg font-semibold sm:text-lg lg:text-lg">{dict?.checkout?.summary ?? "Order summary"}</h2>
              <CartLines resolved={resolved} editable={false} />
              <dl className="space-y-2 border-t pt-3 text-sm">
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
                  disabled={pending}
                  className="mx-auto flex h-12 w-full max-w-lg rounded-full text-base"
                  data-testid="place-order"
                >
                  {pending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {dict?.checkout?.placing ?? "Placing your order…"}
                    </>
                  ) : (
                    interpolate(dict?.checkout?.placeOrder ?? "Place order · {total}", { total: formatRwf(total) })
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
