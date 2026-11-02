"use client"

import { useState, useTransition } from "react"
import { Banknote, Check, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { Priced } from "@/components/atom/price"
import { useDictionary } from "@/components/internationalization/use-dictionary"
import type { TrackedOrder } from "@/components/track/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { payCashInstead, startMomoPayment } from "./actions"

/** After this, offer "send again" even while a prompt is still pending. */
const RESEND_AFTER_MS = 45_000

/**
 * MTN MoMo push-to-pay on the tracking page: "check your phone" while a PIN
 * prompt is out, the receipt once MTN confirms, and a retry (optionally to
 * another number) when it was declined or timed out.
 *
 * `awaiting` = pay-then-place: the order isn't placed until this is paid, so
 * the panel leads the page and a failed payment can switch to cash.
 */
export function MomoPanel({
  token,
  total,
  payment,
  now,
  onChanged,
  manual,
  awaiting = false,
  canPayCash = false,
}: {
  token: string
  total: number
  payment: NonNullable<TrackedOrder["payment"]>
  now: number
  onChanged: () => void
  /** The manual merchant-code box, offered as a fallback. */
  manual: React.ReactNode
  awaiting?: boolean
  /** Offer "Pay cash instead" (awaiting only, cash enabled). */
  canPayCash?: boolean
}) {
  const dict = useDictionary()
  const t = dict?.track
  const [pending, startTransition] = useTransition()
  const [phone, setPhone] = useState("")
  const [showManual, setShowManual] = useState(false)
  const [showNumber, setShowNumber] = useState(false)
  const errorText = (code: string) => (dict?.errors as Record<string, string> | undefined)?.[code] ?? code

  if (payment.status === "PAID") {
    return (
      <section className="mt-6 rounded-2xl bg-emerald-50 p-4 text-emerald-900" data-testid="momo-paid">
        <p className="flex items-center gap-2 font-semibold text-emerald-900">
          <Check className="size-5" />
          {t?.momoPaid ?? "Paid with MTN MoMo"}
        </p>
        {payment.reference && (
          <p className="mt-1 text-sm text-emerald-800">
            {t?.momoReceipt ?? "Receipt"}{" "}
            <span dir="ltr" className="font-semibold tabular-nums" data-testid="momo-receipt">
              {payment.reference}
            </span>
          </p>
        )}
      </section>
    )
  }

  const attempt = payment.attempt
  const waiting = attempt?.status === "PENDING"
  const canResend = !waiting || now - new Date(attempt.createdAt).getTime() > RESEND_AFTER_MS
  const failedKey = attempt && !waiting ? attempt.status : null
  // Pay-then-place keeps the resend tidy: one button, the number behind a link.
  const numberOpen = !awaiting || showNumber

  const run = (action: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.success && res.error) toast.error(errorText(res.error))
      } catch {
        toast.error(errorText("NETWORK"))
      } finally {
        onChanged()
      }
    })
  const send = () => run(() => startMomoPayment({ token, phone: phone.trim() || undefined }))
  const cash = () => run(() => payCashInstead({ token }))

  return (
    <section
      className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
      data-testid="momo-push"
      data-attempt={attempt?.status ?? "NONE"}
      data-awaiting={awaiting || undefined}
    >
      <h2 className="text-lg font-semibold text-amber-950 sm:text-lg lg:text-lg">
        {awaiting ? (t?.payToPlace ?? "Pay to place your order") : t?.payTitle}
      </h2>

      {waiting ? (
        <div className="mt-3 flex items-start gap-3" role="status">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin" />
          <div>
            <p className="font-semibold text-amber-950">{t?.momoCheckPhone ?? "Check your phone"}</p>
            <p className="text-sm text-amber-900">
              <Priced template={t?.momoApprove ?? "Approve {price} with your MoMo PIN."} amount={total} />
            </p>
            {awaiting && <p className="mt-1 text-sm text-amber-900">{t?.momoPlaceHint}</p>}
          </div>
        </div>
      ) : (
        <>
          {failedKey && (
            <p className="mt-2 text-sm font-medium text-destructive" role="alert">
              {(t?.momoFailed as Record<string, string> | undefined)?.[failedKey] ?? failedKey}
            </p>
          )}
          <p className="mt-2 font-semibold text-amber-950">
            <Priced template={t?.payAmount ?? "Amount: {price}"} amount={total} />
          </p>
          <p className="mt-1 text-sm text-amber-900">{awaiting ? t?.momoPlaceHint : t?.momoPushHint}</p>
        </>
      )}

      {canResend && (
        <div className="mt-4 space-y-2">
          {numberOpen ? (
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={20}
              className="h-12 bg-background text-base"
              placeholder={t?.momoNumberPlaceholder ?? "MoMo number (default: your checkout number)"}
              aria-label={t?.momoNumber ?? "MoMo number"}
              data-testid="momo-resend-phone"
            />
          ) : null}
          <Button type="button" className="h-12 w-full rounded-full text-base" onClick={send} disabled={pending} data-testid="momo-send">
            {pending ? <Loader2 className="animate-spin" /> : <Smartphone />}
            {attempt ? (t?.momoResend ?? "Send the prompt again") : (t?.momoSend ?? "Send payment prompt to my phone")}
          </Button>
          {!numberOpen && (
            <button type="button" className="text-sm text-amber-900 underline underline-offset-2" onClick={() => setShowNumber(true)}>
              {t?.momoOtherNumber ?? "Pay from another number"}
            </button>
          )}
        </div>
      )}

      {awaiting && canPayCash && canResend && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-12 w-full rounded-full bg-background text-base"
          onClick={cash}
          disabled={pending}
          data-testid="pay-cash-instead"
        >
          <Banknote />
          {t?.payCashInstead ?? "Pay cash instead"}
        </Button>
      )}

      {manual && (
        <div className="mt-3">
          {showManual ? (
            manual
          ) : (
            <button type="button" className="text-sm text-amber-900 underline underline-offset-2" onClick={() => setShowManual(true)}>
              {t?.momoManual ?? "Or pay by merchant code instead"}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
