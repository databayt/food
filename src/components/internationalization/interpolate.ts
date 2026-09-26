/** Fill `{key}` tokens in a dictionary string: interpolate("Order #{number}", { number: 1042 }). */
export function interpolate(message: string | undefined, params: Record<string, string | number>): string {
  if (!message) return ""
  return message.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match))
}
