import { faChartPie, faInbox } from "@fortawesome/free-solid-svg-icons";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { OUTCOME_COLORS, OUTCOME_LABELS } from "../api";
import { Card, EmptyState } from "./Card";

export function OutcomeChart({ distribution }: { distribution: Record<string, number> }) {
  const data = Object.entries(distribution).map(([key, count]) => ({
    key,
    name: OUTCOME_LABELS[key] ?? key,
    value: count,
  }));

  return (
    <Card title="Call outcomes" icon={faChartPie} className="min-h-[290px]">
      {data.length === 0 ? (
        <EmptyState icon={faInbox}>No calls yet</EmptyState>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={OUTCOME_COLORS[entry.key] ?? "#64748b"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
