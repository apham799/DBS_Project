"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import type { Suggestion } from "@/lib/suggestions";

// One suggestion from golfers' reports, with what an admin can do about it.
// Used in the Suggestions box on a place page and on the Admin page. Each
// page decides what the actions do, and whether "Edit first" is a button or
// a link to the place's forms.
export function SuggestionCard({
  suggestion: s,
  areaLabel,
  busy,
  onApply,
  editFirst,
  onDismiss,
}: {
  suggestion: Suggestion;
  areaLabel: (id: string | null) => string;
  busy: boolean;
  onApply?: () => void; // Confirm / End it / Fill in the hours, when it can be done here
  editFirst?: ReactNode; // a button or link
  onDismiss: () => void;
}) {
  const confirmable = s.kind === "agree" || s.kind === "season";
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-rule bg-surface p-4">
      <p className="font-semibold text-ink">{s.title}</p>
      <p className="text-label font-normal text-muted">{s.detail}</p>
      {confirmable && (
        <p className="text-label text-ink">
          Would confirm: {areaLabel(s.rule.areaId)}, {s.rule.condition}, &ldquo;{s.rule.note}&rdquo;
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {onApply && (
          <Button size="sm" disabled={busy} onClick={onApply}>
            {s.kind === "review" ? "End it" : s.kind === "hours" ? "Fill in the hours" : "Confirm"}
          </Button>
        )}
        {editFirst}
        <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
      </div>
    </li>
  );
}
