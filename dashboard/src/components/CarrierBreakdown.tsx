import { faTruckField, faUsersSlash } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import { fmtPct, fmtUsd, type CarrierStat } from "../api";
import { Card, EmptyState } from "./Card";

const COLUMNS = [
  "carrier",
  "mc",
  "calls",
  "booked",
  "conversion",
  "rounds",
  "margin",
  "revenue",
] as const;

const CELL = "whitespace-nowrap border-b border-slate-100 px-2.5 py-2 dark:border-slate-700/60";
const NUM = `${CELL} text-right tabular-nums`;

/** Per-carrier scorecard. `avg_margin` is loadboard − final on booked calls:
 * positive means the carrier booked below list (good for the broker) → green. */
export function CarrierBreakdown({ carriers }: { carriers: CarrierStat[] }) {
  const { t } = useTranslation();

  return (
    <Card title={t("carriers.title")} icon={faTruckField} className="overflow-x-auto">
      {carriers.length === 0 ? (
        <EmptyState icon={faUsersSlash}>{t("carriers.empty")}</EmptyState>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className={`border-b border-slate-200 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400 ${
                    col === "carrier" || col === "mc" ? "text-left" : "text-right"
                  }`}
                >
                  {t(`carriers.col.${col}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carriers.map((c) => {
              const margin = c.avg_margin;
              return (
                <tr
                  key={c.mc_number}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <td className={`${CELL} font-medium`}>{c.carrier_name ?? "—"}</td>
                  <td className={`${CELL} text-slate-500 dark:text-slate-400`}>
                    {c.mc_number}
                  </td>
                  <td className={NUM}>{c.calls}</td>
                  <td className={NUM}>{c.booked}</td>
                  <td className={NUM}>{fmtPct(c.conversion_rate * 100)}</td>
                  <td className={NUM}>{c.avg_rounds == null ? "—" : c.avg_rounds.toFixed(1)}</td>
                  <td className={NUM}>
                    {margin == null ? (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    ) : (
                      <span
                        className={
                          margin >= 0
                            ? "font-semibold text-green-600 dark:text-green-400"
                            : "font-semibold text-red-600 dark:text-red-400"
                        }
                      >
                        {margin >= 0 ? "+" : "−"}
                        {fmtUsd(Math.abs(margin))}
                      </span>
                    )}
                  </td>
                  <td className={`${NUM} font-semibold`}>{fmtUsd(c.revenue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
