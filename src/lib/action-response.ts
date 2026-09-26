/**
 * Shared ActionResponse type for server actions (hogwarts pattern).
 *
 * `error` is always a translatable CODE (e.g. "ITEM_UNAVAILABLE"), never
 * English prose — the client maps it through `dict.errors[code]`.
 */
export type ActionResponse<T = undefined> =
  | { success: true; data: T }
  | {
      success: false
      error: string
      /** Field-level validation codes keyed by field path. */
      errors?: Record<string, string>
      /** Extra machine-readable detail (e.g. which item ids are unavailable). */
      details?: Record<string, unknown>
    }

export function ok<T>(data: T): ActionResponse<T> {
  return { success: true, data }
}

export function fail(
  error: string,
  extra?: { errors?: Record<string, string>; details?: Record<string, unknown> }
): { success: false; error: string; errors?: Record<string, string>; details?: Record<string, unknown> } {
  return { success: false, error, ...extra }
}
