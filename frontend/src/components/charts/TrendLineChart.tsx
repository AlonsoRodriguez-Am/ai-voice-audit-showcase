import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { TrendDataPoint } from '../../types';

interface TrendLineChartProps {
  data: TrendDataPoint[];
  title?: string;
}

const GRADIENT_ID = 'trendGradient';

const TrendLineChart = ({ data, title }: TrendLineChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--tx-3)] text-sm">
        No trend data available
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {title && <h4 className="text-sm font-semibold text-[var(--tx-2)] mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
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
          <YAxis stroke="var(--tx-3)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
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
            formatter={(value: any, name: any) => {
              const labels: Record<string, string> = {
                avg_score: 'Avg Score',
                total_evals: 'Evaluations',
                error_count: 'Errors',
              };
              return [typeof value === 'number' ? value.toFixed(1) : value, labels[name] || name];
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                avg_score: 'Average Score',
                total_evals: 'Total Evaluations',
              };
              return <span className="text-xs text-[var(--tx-2)] font-bold">{labels[value] || value}</span>;
            }}
          />
          <Line
            type="monotone"
            dataKey="avg_score"
            stroke="var(--accent)"
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--bg-s1)' }}
            activeDot={{ r: 6, fill: 'var(--accent-h)', strokeWidth: 2, stroke: 'var(--bg-s1)' }}
          />
          <Line
            type="monotone"
            dataKey="total_evals"
            stroke="#06b6d4"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            yAxisId={0}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendLineChart;
