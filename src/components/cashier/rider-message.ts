import { interpolate } from "@/components/internationalization/interpolate";
import { mapsUrl, orderPin } from "@/lib/order/location";
import { formatRwf } from "@/lib/order/money";
import { formatLocalPhone } from "@/lib/order/phone";

import type { CashierOrder } from "./types";

export type RiderTemplates = {
  title: string;
  customer: string;
  phone: string;
  address: string;
  map: string;
  items: string;
  note: string;
  collect: string;
  paid: string;
};

/**
 * Everything a moto rider needs, as one WhatsApp message: who, where (address
 * and map pin), what, and how much to collect at the door.
 */
export function riderMessage(
  order: CashierOrder,
  t: RiderTemplates,
  { restaurant, methodLabel }: { restaurant: string; methodLabel: string },
): string {
  const pin = orderPin(order);
  const lines: (string | null)[] = [
    interpolate(t.title, { restaurant, number: order.number }),
    interpolate(t.customer, { name: order.customerName }),
    interpolate(t.phone, { phone: formatLocalPhone(order.customerPhone) }),
    order.deliveryAddress
      ? interpolate(t.address, { address: order.deliveryAddress })
      : null,
    pin ? interpolate(t.map, { url: mapsUrl(pin.lat, pin.lng) }) : null,
    "",
    t.items,
    ...order.items.map(
      (i) =>
        `${i.quantity}× ${i.name}${i.modifiers.length > 0 ? ` (+ ${i.modifiers.join(", ")})` : ""}`,
    ),
    order.note ? interpolate(t.note, { note: order.note }) : null,
    "",
    order.payment?.status === "PAID"
      ? t.paid
      : interpolate(t.collect, {
          amount: formatRwf(order.total),
          method: methodLabel,
        }),
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

/** wa.me link with no number: WhatsApp asks which chat to send it to. */
export function shareOnWhatsApp(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
