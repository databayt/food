/**
 * Rwandan franc formatting. RWF has no minor unit (ISO 4217 exponent 0), so
 * every stored amount is an integer number of francs.
 *
 * Output matches the printed menu — "4,000 RWF" — in every locale, with Latin
 * digits. In RTL, wrap the result in <bdi dir="ltr"> (see <Price />).
 */
const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

export function assertFrancs(amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`Invalid RWF amount: ${amount}`)
  }
  return amount
}

export function formatRwf(amount: number): string {
  return `${grouping.format(assertFrancs(amount))} RWF`
}
