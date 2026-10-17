import type { TagStatsItem } from "@/lib/api-client";
import { percent } from "@/lib/stats";

/** Attempts and success rate per tag. A drill with several tags counts under each one, so
 *  the rows do not add up to the total. */
export function TagTable({ items }: { items: TagStatsItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid="tag-table">
        <thead>
          <tr className="text-left text-[13px] text-muted">
            <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Tag</th>
            <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Attempts</th>
            <th scope="col" className="border-b border-line px-3 py-2.5 font-medium">Success</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.tag_id} data-testid="tag-row">
              <th scope="row" className="border-b border-line px-3 py-2.5 text-left font-normal">
                {item.name}
              </th>
              <td className="border-b border-line px-3 py-2.5 font-mono">{item.attempts}</td>
              <td className="border-b border-line px-3 py-2.5 font-mono">
                {percent(item.success_rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        A drill with several tags counts under each, so rows do not add up to the total.
      </p>
    </div>
  );
}
