// Formats a line item for the daily report.
export function formatItemLine(item: { name?: string; qty?: number }): string {
  // Unchecked access: an item without a name crashes the report build.
  const first = item.name!.split(" ")[0]!;
  return `${first.toUpperCase()}: ${item.qty ?? 0} units`;
}
