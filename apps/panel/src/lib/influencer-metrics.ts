export type ViewSnapshot = { captured_at: string; views: number };

/** Kümülatif sayaçlardan son 7 günde kazanılan izlenmeyi hesaplar. */
export function sevenDayViews(snapshots: ViewSnapshot[], since: Date): number {
  const ordered = [...snapshots].sort(
    (a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at),
  );
  if (ordered.length === 0) return 0;

  let baseline: ViewSnapshot | undefined;
  let latest: ViewSnapshot | undefined;
  for (const snapshot of ordered) {
    if (Date.parse(snapshot.captured_at) <= since.getTime())
      baseline = snapshot;
    latest = snapshot;
  }
  if (!latest) return 0;
  if (!baseline) return Math.max(0, latest.views);
  return Math.max(0, latest.views - baseline.views);
}

export function sumSevenDayViews(
  snapshotsByPost: Map<string, ViewSnapshot[]>,
  since: Date,
) {
  let total = 0;
  for (const snapshots of snapshotsByPost.values()) {
    total += sevenDayViews(snapshots, since);
  }
  return total;
}
