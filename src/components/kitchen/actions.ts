"use server"

import type { KitchenOrder } from "@/components/cashier/types"
import { toLocale } from "@/components/internationalization/config"
import { fail, ok, type ActionResponse } from "@/lib/action-response"
import { getStaffSession } from "@/lib/auth"
import { ROUTE_ROLES } from "@/routes"

import { getKitchenQueue } from "./queries"

/** Live kitchen queue (polled every 5 s). Transitions use cashier/actions. */
export async function fetchKitchenQueue(locale: string): Promise<ActionResponse<KitchenOrder[]>> {
  const session = await getStaffSession(ROUTE_ROLES.kitchen)
  if (!session) return fail("FORBIDDEN")
  return ok(await getKitchenQueue(toLocale(locale)))
}
