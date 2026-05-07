"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTimeIST } from "@/lib/ist/time";

type Item = {
  id: string;
  name: string;
  photo_url: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  hidden_at: string | null;
  report_count: number;
  reasons: string[];
};

type Filter = "all" | "reported" | "hidden";

export default function ListingsClient({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmDelete, setConfirmDelete] = useState<Item | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/listings");
    const body = await res.json();
    setItems(body.items ?? []);
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load();
  }, []);

  async function act(id: string, path: string) {
    setPendingId(id);
    try {
      await fetch(`/api/admin/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setPendingId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  const visible = useMemo(() => {
    if (filter === "reported") return items.filter((i) => i.report_count > 0);
    if (filter === "hidden") return items.filter((i) => Boolean(i.hidden_at));
    return items;
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      all: items.length,
      reported: items.filter((i) => i.report_count > 0).length,
      hidden: items.filter((i) => Boolean(i.hidden_at)).length,
    }),
    [items]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-saffron-700">All Bhandaras</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{adminEmail}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="reported">Reported ({counts.reported})</TabsTrigger>
          <TabsTrigger value="hidden">Hidden ({counts.hidden})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground">No listings to show. 🪔</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((it) => (
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
                    className="w-20 h-15 bg-saffron-100 rounded-md flex items-center justify-center text-2xl shrink-0"
                    aria-hidden
                  >
                    🪔
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{it.name}</span>
                    {it.report_count > 0 && (
                      <Badge variant="secondary">
                        {it.report_count} report{it.report_count === 1 ? "" : "s"}
                      </Badge>
                    )}
                    {it.hidden_at && <Badge variant="destructive">Hidden</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {it.event_date} · {formatTimeIST(it.start_time)} – {formatTimeIST(it.end_time)}
                    <span className="ml-2 opacity-70">
                      submitted {new Date(it.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {it.reasons.length > 0 && (
                    <ul className="mt-2 pl-4 list-disc text-sm">
                      {it.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {it.hidden_at ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingId === it.id}
                      onClick={() => act(it.id, "unhide")}
                    >
                      Unhide
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingId === it.id}
                      onClick={() => act(it.id, "hide")}
                    >
                      Hide
                    </Button>
                  )}
                  {it.report_count > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === it.id}
                      onClick={() => act(it.id, "dismiss")}
                    >
                      Dismiss
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pendingId === it.id}
                    onClick={() => setConfirmDelete(it)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.name}. This permanently removes the row and the photo. This
              action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pendingId === confirmDelete?.id}
              onClick={async () => {
                if (!confirmDelete) return;
                const id = confirmDelete.id;
                setConfirmDelete(null);
                await act(id, "delete");
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
