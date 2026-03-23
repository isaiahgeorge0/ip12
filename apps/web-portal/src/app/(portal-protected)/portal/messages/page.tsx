"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

type MessageRow = {
  id: string;
  agencyId: string;
  type: string;
  propertyDisplayLabel: string;
  createdAt: number | null;
  actedAt: number | null;
};

export default function PortalMessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/portal/messages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleAccept = useCallback(
    (messageId: string, agencyId: string) => {
      setAcceptingId(messageId);
      fetch(`/api/portal/messages/${messageId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId }),
      })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (r.ok && data.redirect) {
            setToast("Opening application…");
            router.push(data.redirect);
            load();
          } else {
            setToast(data?.error ?? "Failed");
          }
        })
        .catch(() => setToast("Failed"))
        .finally(() => setAcceptingId(null));
    },
    [router, load]
  );

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
      <PageHeader title="Messages" />
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : messages.length === 0 ? (
        <EmptyState
          title="No messages"
          description="When an agent sends you a message (for example after a viewing), it will appear here."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const isProceedPrompt = m.type === "proceed_prompt";
            const acted = m.actedAt != null;
            return (
              <Card key={`${m.agencyId}-${m.id}`} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">{m.propertyDisplayLabel}</p>
                    <p className="text-sm text-zinc-500 mt-0.5">
                      {m.createdAt != null ? new Date(m.createdAt).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div>
                    {isProceedPrompt && acted && (
                      <span className="rounded px-2 py-1 text-xs font-medium bg-zinc-200 text-zinc-700">
                        Proceeded
                      </span>
                    )}
                    {isProceedPrompt && !acted && (
                      <button
                        type="button"
                        disabled={!!acceptingId}
                        onClick={() => handleAccept(m.id, m.agencyId)}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {acceptingId === m.id ? "Opening…" : "Proceed with application"}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
