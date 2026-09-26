import { Skeleton } from "@/components/ui/skeleton"

/**
 * Route ghosts (mkan atom/skeletons): every loading.tsx draws the shape of
 * its page, not a spinner, so slow networks show structure immediately.
 */
function HeaderGhost() {
  return (
    <div className="sticky top-0 z-40 h-14 border-b bg-background">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3 px-4">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ms-auto h-8 w-24 rounded-full" />
      </div>
    </div>
  )
}

export function MenuSkeleton() {
  return (
    <div aria-busy="true">
      <HeaderGhost />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Skeleton className="h-9 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-40 w-30 rounded-2xl" />
          <Skeleton className="h-40 w-52 rounded-2xl" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PageListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      <HeaderGhost />
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  )
}

export function BoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl px-4 py-4">
      <Skeleton className="mb-4 h-8 w-32" />
      <div className="grid gap-4 lg:grid-flow-col lg:auto-cols-fr">
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className={i > 0 ? "hidden space-y-3 lg:block" : "space-y-3"}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}
