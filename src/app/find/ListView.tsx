"use client";

import BadamangalCard, { type FindItem } from "./BadamangalCard";
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return <Skeleton className="h-56 mb-3 rounded-md" />;
}

export default function ListView({
  items,
  loading,
  onReport,
}: {
  items: FindItem[];
  loading: boolean;
  onReport: (id: string) => void;
}) {
  if (loading) {
    return (
      <div>
        {[0, 1, 2].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground mt-8">
        <p>No bhandaras found within this radius.</p>
        <p className="text-sm">Try expanding the search, or check back later 🪔</p>
      </div>
    );
  }
  return (
    <div>
      {items.map((it) => (
        <BadamangalCard key={it.id} item={it} onReport={onReport} />
      ))}
    </div>
  );
}
