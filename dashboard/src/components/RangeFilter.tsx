import { faCalendarDay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";

// `undefined` = all history; the others map to ?days=N on /api/metrics.
export type RangeValue = 7 | 30 | 90 | undefined;
const OPTIONS: { key: string; value: RangeValue }[] = [
  { key: "7d", value: 7 },
  { key: "30d", value: 30 },
  { key: "90d", value: 90 },
  { key: "all", value: undefined },
];

export function RangeFilter({
  value,
  onChange,
}: {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex items-center gap-1.5">
      <FontAwesomeIcon
        icon={faCalendarDay}
        className="text-xs text-slate-400 dark:text-slate-500"
        title={t("range.label")}
      />
      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium dark:border-slate-700">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              value === o.value
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {t(`range.${o.key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
