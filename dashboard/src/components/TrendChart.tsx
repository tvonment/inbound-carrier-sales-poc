import { faChartArea, faInbox } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyStat } from "../api";
import { localeFor } from "../i18n";
import { useTheme } from "../theme/ThemeProvider";
import { Card, EmptyState } from "./Card";

export function TrendChart({ data }: { data: DailyStat[] }) {
  const { t, i18n } = useTranslation();
  const dark = useTheme().resolvedTheme === "dark";
  const axisColor = dark ? "#94a3b8" : "#64748b";
  const gridColor = dark ? "#334155" : "#e2e8f0";

  const dayFmt = new Intl.DateTimeFormat(localeFor(i18n.language), {
    month: "short",
    day: "numeric",
  });
  const rows = data.map((d) => ({
    ...d,
    // Parse as local midnight so the label matches the bucket date.
    label: dayFmt.format(new Date(d.date + "T00:00:00")),
  }));

  return (
    <Card title={t("trend.title")} icon={faChartArea}>
      {rows.length === 0 ? (
        <EmptyState icon={faInbox}>{t("trend.empty")}</EmptyState>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trendTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendBooked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tickLine={false} tick={{ fill: axisColor }} />
            <YAxis allowDecimals={false} tickLine={false} tick={{ fill: axisColor }} />
            <Tooltip
              contentStyle={
                dark
                  ? { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }
                  : undefined
              }
            />
            <Legend wrapperStyle={dark ? { color: "#cbd5e1" } : undefined} />
            <Area
              type="monotone"
              dataKey="total"
              name={t("trend.calls")}
              stroke="#3b82f6"
              fill="url(#trendTotal)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="booked"
              name={t("trend.booked")}
              stroke="#16a34a"
              fill="url(#trendBooked)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
