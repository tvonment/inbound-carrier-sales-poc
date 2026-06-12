import { faFaceSmile, faInbox } from "@fortawesome/free-solid-svg-icons";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SENTIMENT_COLORS } from "../api";
import { Card, EmptyState } from "./Card";

const ORDER = ["positive", "neutral", "negative"];

export function SentimentChart({ distribution }: { distribution: Record<string, number> }) {
  const data = ORDER.map((key) => ({
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: distribution[key] ?? 0,
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card title="Carrier sentiment" icon={faFaceSmile} className="min-h-[290px]">
      {total === 0 ? (
        <EmptyState icon={faInbox}>No calls yet</EmptyState>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tickLine={false} />
            <YAxis allowDecimals={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
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
