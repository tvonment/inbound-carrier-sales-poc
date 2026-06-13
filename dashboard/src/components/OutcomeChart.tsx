import { faChartPie, faInbox } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { OUTCOME_COLORS } from "../api";
import { useTheme } from "../theme/ThemeProvider";
import { Card, EmptyState } from "./Card";

export function OutcomeChart({ distribution }: { distribution: Record<string, number> }) {
  const { t } = useTranslation();
  const dark = useTheme().resolvedTheme === "dark";

  const data = Object.entries(distribution).map(([key, count]) => ({
    key,
    name: t(`outcome.${key}`, { defaultValue: key }),
    value: count,
  }));

  return (
    <Card title={t("outcomes.title")} icon={faChartPie} className="min-h-[290px]">
      {data.length === 0 ? (
        <EmptyState icon={faInbox}>{t("outcomes.empty")}</EmptyState>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={OUTCOME_COLORS[entry.key] ?? "#64748b"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={
                dark
                  ? { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }
                  : undefined
              }
            />
            <Legend wrapperStyle={dark ? { color: "#cbd5e1" } : undefined} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
