import { faFaceSmile, faInbox } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SENTIMENT_COLORS } from "../api";
import { useTheme } from "../theme/ThemeProvider";
import { Card, EmptyState } from "./Card";

const ORDER = ["positive", "neutral", "negative"];

export function SentimentChart({ distribution }: { distribution: Record<string, number> }) {
  const { t } = useTranslation();
  const dark = useTheme().resolvedTheme === "dark";
  const axisColor = dark ? "#94a3b8" : "#64748b";

  const data = ORDER.map((key) => ({
    key,
    name: t(`sentimentValue.${key}`),
    value: distribution[key] ?? 0,
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card title={t("sentiment.title")} icon={faFaceSmile} className="min-h-[290px]">
      {total === 0 ? (
        <EmptyState icon={faInbox}>{t("sentiment.empty")}</EmptyState>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tickLine={false} tick={{ fill: axisColor }} />
            <YAxis allowDecimals={false} tickLine={false} tick={{ fill: axisColor }} />
            <Tooltip
              cursor={{ fill: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
              contentStyle={
                dark
                  ? { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }
                  : undefined
              }
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
