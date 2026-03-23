"use client";

import Link from "next/link";
import { Card } from "@/components/Card";
import type { NextActionResult } from "@/lib/workflow/getNextAction";

type AdminNextActionCardProps = {
  action: NextActionResult | null;
  /** Optional: show a neutral state when there is no recommended action */
  emptyMessage?: string;
};

export function AdminNextActionCard({ action, emptyMessage }: AdminNextActionCardProps) {
  if (!action) {
    return (
      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-0.5">Next recommended action</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {emptyMessage ?? "No specific action recommended. Review sections below for next steps."}
        </p>
      </Card>
    );
  }

  return (
    <Card
      className={`p-4 mb-6 ${action.priority === "urgent" ? "border-amber-300 bg-amber-50/30" : ""}`}
    >
      <h2 className="text-base font-medium text-zinc-900 mb-0.5">Next recommended action</h2>
      <p className="font-medium text-zinc-800 mt-1">{action.label}</p>
      <p className="text-sm text-zinc-600 mt-0.5">{action.description}</p>
      {action.actionLink && (
        <Link
          href={action.actionLink}
          className={`mt-3 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${
            action.priority === "urgent"
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          {action.label}
          <span className="ml-1">→</span>
        </Link>
      )}
    </Card>
  );
}
