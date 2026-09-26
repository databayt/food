"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useDictionary } from "@/components/internationalization/use-dictionary"
import type { ActionResponse } from "@/lib/action-response"

/** Run an admin server action with pending state, toasts and a refresh. */
export function useAdminAction() {
  const dict = useDictionary()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const errorText = (code: string) => (dict?.errors as Record<string, string> | undefined)?.[code] ?? dict?.errors?.GENERIC ?? code

  const run = <T,>(action: () => Promise<ActionResponse<T>>, opts: { success?: string; onSuccess?: (data: T) => void } = {}) =>
    startTransition(async () => {
      try {
        const res = await action()
        if (res.success) {
          toast.success(opts.success ?? dict?.common?.saved ?? "Saved")
          opts.onSuccess?.(res.data)
          router.refresh()
        } else {
          toast.error(errorText(res.error))
        }
      } catch {
        toast.error(errorText("NETWORK"))
      }
    })

  return { run, pending, errorText }
}
