"use client"

import Image from "next/image"
import { Expand } from "lucide-react"

import { useDictionary } from "@/components/internationalization/use-dictionary"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import type { MenuImage } from "@/components/restaurant/queries"

/**
 * The owner's photographed printed menu, shown as a reference visual — never
 * as a product photo. Thumbnails load the 640px WebP; tap opens the 1280px
 * version in a dialog.
 */
export function PrintedMenu({ images }: { images: MenuImage[] }) {
  const dict = useDictionary()
  if (images.length === 0) return null
  const altFor = (key: string) =>
    (dict?.order?.printedMenuAlt as Record<string, string> | undefined)?.[key] ?? dict?.order?.printedMenu ?? ""

  return (
    <section aria-labelledby="printed-menu" className="mx-auto max-w-5xl px-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="printed-menu" className="text-base font-semibold sm:text-base lg:text-base">
          {dict?.order?.printedMenu ?? "Our printed menu"}
        </h2>
        <span className="text-xs text-muted-foreground">{dict?.order?.printedMenuHint ?? "Tap to zoom"}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {images.map((img, index) => (
          <Dialog key={img.src}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="group relative h-40 shrink-0 overflow-hidden rounded-2xl border bg-muted sm:h-48"
                style={{ aspectRatio: `${img.width} / ${img.height}` }}
              >
                <Image
                  src={`${img.src}-640.webp`}
                  alt={altFor(img.alt)}
                  fill
                  sizes="(max-width: 640px) 60vw, 320px"
                  loading={index === 0 ? "eager" : "lazy"}
                  className="object-cover transition-transform group-hover:scale-[1.02]"
                />
                <span className="absolute bottom-2 end-2 grid size-8 place-items-center rounded-full bg-background/90 shadow">
                  <Expand className="size-4" />
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[95dvh] w-[calc(100%-1rem)] max-w-3xl overflow-auto p-2 sm:p-3">
              <DialogTitle className="sr-only">{altFor(img.alt)}</DialogTitle>
              <Image
                src={`${img.src}-1280.webp`}
                alt={altFor(img.alt)}
                width={img.width}
                height={img.height}
                sizes="(max-width: 768px) 100vw, 768px"
                className="h-auto w-full rounded-lg"
              />
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </section>
  )
}
