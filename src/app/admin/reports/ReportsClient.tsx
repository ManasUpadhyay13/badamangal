"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Item = {
  id: string;
  name: string;
  photo_url: string | null;
  event_date: string;
  hidden_at: string | null;
  report_count: number;
  reasons: string[];
  latest_report_at?: string;
};

export default function ReportsClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/reports");
    const body = await res.json();
    setItems(body.items ?? []);
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load();
  }, []);

  async function act(id: string, action: "hide" | "dismiss") {
    setPendingId(id);
    try {
      await fetch(`/api/admin/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (items.length === 0) return <p>No reports queued. 🪔</p>;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-saffron-700">Reports queue</h1>
      {items.map((it) => (
        <Card key={it.id}>
          <CardContent className="flex gap-4 items-start p-4">
            {it.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.photo_url}
                alt={it.name}
                className="w-20 h-15 object-cover rounded-md"
              />
            ) : (
              <div
                className="w-20 h-15 bg-saffron-100 rounded-md flex items-center justify-center text-2xl"
                aria-hidden
              >
                🪔
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{it.name}</span>
                <Badge variant="secondary">
                  {it.report_count} report{it.report_count === 1 ? "" : "s"}
                </Badge>
                {it.hidden_at && <Badge variant="destructive">Hidden</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">Event {it.event_date}</div>
              {it.reasons.length > 0 && (
                <ul className="mt-2 pl-4 list-disc text-sm">
                  {it.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pendingId === it.id || Boolean(it.hidden_at)}
                onClick={() => act(it.id, "hide")}
              >
                Hide
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pendingId === it.id}
                onClick={() => act(it.id, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
