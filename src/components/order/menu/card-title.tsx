"use client";

import { useEffect, useRef, useState } from "react";

import { Price } from "@/components/atom/price";

/**
 * A menu card's text, always exactly two lines (Figma menu sheet):
 * "Classic Beef Burger - 3,000 R₣" runs inline and clamps at two lines;
 * when name and price would fit on ONE line, the price drops to the second
 * line so every card keeps the same rhythm.
 *
 * Fit is measured, not guessed: a hidden, single-line copy is compared with
 * the available width (ResizeObserver keeps it right across rotations and
 * locales). Two lines are always reserved, so the switch never shifts layout.
 */
export function CardTitle({ name, price }: { name: string; price: number }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    const probe = probeRef.current;
    if (!box || !probe) return;
    const observer = new ResizeObserver(() => {
      setStacked(probe.scrollWidth <= box.clientWidth);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [name, price]);

  return (
    <span
      ref={boxRef}
      dir="auto"
      className="relative block min-h-[2.75em] text-xs font-medium leading-snug text-foreground"
    >
      {stacked ? (
        <>
          <span className="block truncate">{name}</span>
          <Price amount={price} />
        </>
      ) : (
        <span className="line-clamp-2">
          {name}
          {" - "}
          <Price amount={price} />
        </span>
      )}
      {/* Single-line probe used only for measuring. */}
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute start-0 top-0 whitespace-nowrap"
      >
        {name}
        {" - "}
        <Price amount={price} />
      </span>
    </span>
  );
}
