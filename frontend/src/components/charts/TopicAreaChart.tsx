import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { TopicTrendsResponse } from '../../types';

interface TopicAreaChartProps {
  data: TopicTrendsResponse;
  title?: string;
}

const COLORS = [
  '#C9A962', '#06b6d4', '#FBBF24', '#34D399', '#a78bfa',
];

const TopicAreaChart = ({ data, title }: TopicAreaChartProps) => {
  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--tx-3)] text-sm">
        No topic trend data available
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {title && <h4 className="text-sm font-semibold text-[var(--tx-2)] mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            {data.topics.map((topic, index) => (
              <linearGradient key={topic} id={`topicGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="period"
            stroke="var(--tx-3)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => {
              const d = new Date(val);
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis stroke="var(--tx-3)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-s2)',
              borderRadius: '12px',
              border: '1px solid rgba(201,169,98,0.3)',
              color: 'var(--tx-1)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
            }}
            labelFormatter={(val) => {
              const d = new Date(val);
              return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-[var(--tx-2)] font-bold">{value}</span>
            )}
          />
          {data.topics.map((topic, index) => (
            <Area
              key={topic}
              type="monotone"
              dataKey={topic}
              stackId="1"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              fill={`url(#topicGrad-${index})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TopicAreaChart;
