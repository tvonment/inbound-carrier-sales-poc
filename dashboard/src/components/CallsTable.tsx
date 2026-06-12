import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faClockRotateLeft,
  faFaceFrown,
  faFaceMeh,
  faFaceSmile,
  faPhoneSlash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fmtUsd, OUTCOME_COLORS, OUTCOME_LABELS, type CallRecord } from "../api";
import { Card, EmptyState } from "./Card";

const HEADERS = ["Time", "Carrier", "MC #", "Load", "Outcome", "Sentiment", "Rounds", "Final rate"];

const SENTIMENT_META: Record<string, { icon: IconDefinition; className: string }> = {
  positive: { icon: faFaceSmile, className: "text-green-600" },
  neutral: { icon: faFaceMeh, className: "text-slate-500" },
  negative: { icon: faFaceFrown, className: "text-red-600" },
};

export function CallsTable({ calls }: { calls: CallRecord[] }) {
  return (
    <Card title="Recent calls" icon={faClockRotateLeft} className="overflow-x-auto">
      {calls.length === 0 ? (
        <EmptyState icon={faPhoneSlash}>
          No calls yet — make a test call to see data here.
        </EmptyState>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {HEADERS.map((header) => (
                <th
                  key={header}
                  className="border-b border-slate-200 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => {
              const sentiment = call.sentiment ? SENTIMENT_META[call.sentiment] : undefined;
              return (
                <tr key={call.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {new Date(call.created_at + "Z").toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {call.carrier_name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {call.mc_number ?? "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {call.load_id ?? "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: OUTCOME_COLORS[call.outcome] ?? "#64748b" }}
                    >
                      {OUTCOME_LABELS[call.outcome] ?? call.outcome}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {sentiment ? (
                      <span className={`inline-flex items-center gap-1.5 ${sentiment.className}`}>
                        <FontAwesomeIcon icon={sentiment.icon} />
                        {call.sentiment}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {call.negotiation_rounds ?? "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-2.5 py-2">
                    {fmtUsd(call.final_rate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
