import { cn } from "@/lib/utils";

/** Loading placeholders must mirror the real shape (SPEC 6.4 #9) — no spinners. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-track animate-pulse rounded-xl", className)}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4">
      <Skeleton className="h-4 w-16 rounded-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-6 rounded-full" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="border-line bg-surface flex items-center gap-4 rounded-2xl border p-4">
      <Skeleton className="size-11 shrink-0" />
      <div className="flex w-full flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
