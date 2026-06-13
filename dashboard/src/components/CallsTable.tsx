import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faClockRotateLeft,
  faFaceFrown,
  faFaceMeh,
  faFaceSmile,
  faPhoneSlash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";
import { fmtUsd, OUTCOME_COLORS, type CallRecord } from "../api";
import { localeFor } from "../i18n";
import { Card, EmptyState } from "./Card";

const COLUMNS = [
  "time",
  "carrier",
  "mc",
  "load",
  "outcome",
  "sentiment",
  "rounds",
  "finalRate",
] as const;

const CELL = "whitespace-nowrap border-b border-slate-100 px-2.5 py-2 dark:border-slate-700/60";

const SENTIMENT_META: Record<string, { icon: IconDefinition; className: string }> = {
  positive: { icon: faFaceSmile, className: "text-green-600 dark:text-green-400" },
  neutral: { icon: faFaceMeh, className: "text-slate-500 dark:text-slate-400" },
  negative: { icon: faFaceFrown, className: "text-red-600 dark:text-red-400" },
};

export function CallsTable({ calls }: { calls: CallRecord[] }) {
  const { t, i18n } = useTranslation();
  const dateFmt = new Intl.DateTimeFormat(localeFor(i18n.language), {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <Card title={t("table.title")} icon={faClockRotateLeft} className="overflow-x-auto">
      {calls.length === 0 ? (
        <EmptyState icon={faPhoneSlash}>{t("table.empty")}</EmptyState>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="border-b border-slate-200 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400"
                >
                  {t(`table.col.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => {
              const sentiment = call.sentiment ? SENTIMENT_META[call.sentiment] : undefined;
              return (
                <tr key={call.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                  <td className={CELL}>{dateFmt.format(new Date(call.created_at + "Z"))}</td>
                  <td className={CELL}>{call.carrier_name ?? "—"}</td>
                  <td className={CELL}>{call.mc_number ?? "—"}</td>
                  <td className={CELL}>{call.load_id ?? "—"}</td>
                  <td className={CELL}>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: OUTCOME_COLORS[call.outcome] ?? "#64748b" }}
                    >
                      {t(`outcome.${call.outcome}`, { defaultValue: call.outcome })}
                    </span>
                  </td>
                  <td className={CELL}>
                    {sentiment && call.sentiment ? (
                      <span className={`inline-flex items-center gap-1.5 ${sentiment.className}`}>
                        <FontAwesomeIcon icon={sentiment.icon} />
                        {t(`sentimentValue.${call.sentiment}`)}
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">—</span>
                    )}
                  </td>
                  {/* 0 is a real value (booked at list, no haggling); only null is N/A. */}
                  <td className={CELL}>{call.negotiation_rounds ?? "—"}</td>
                  <td className={CELL}>{fmtUsd(call.final_rate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
