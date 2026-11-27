import type { Report } from "./types";

// Which reports count toward statuses, summaries and the map. Hidden ones are
// never deleted: like hidden comments, anyone can choose to see them, and the
// list says why each one is hidden.

// Voted down by this many more golfers than voted it up: probably wrong.
export const VOTE_HIDE_MARGIN = 2;

export type HiddenWhy = { kind: "admin"; reason: string | null } | { kind: "votes"; down: number; up: number };

export function hiddenWhy(r: Report): HiddenWhy | null {
  if (r.hiddenAt) return { kind: "admin", reason: r.hiddenReason ?? null };
  const up = r.upVotes ?? 0;
  const down = r.downVotes ?? 0;
  if (down - up >= VOTE_HIDE_MARGIN) return { kind: "votes", down, up };
  return null;
}

export const counts = (r: Report) => hiddenWhy(r) === null;

export function hiddenLabel(why: HiddenWhy): string {
  return why.kind === "admin"
    ? `Hidden by an admin${why.reason ? `: ${why.reason}` : ""}`
    : `Hidden: voted down by ${why.down} golfer${why.down === 1 ? "" : "s"}${why.up ? `, up by ${why.up}` : ""}`;
}
