import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { CTQDistributionItem } from '../../types';

interface CTQBarChartProps {
  data: CTQDistributionItem[];
  title?: string;
}

const CTQBarChart = ({ data, title }: CTQBarChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--tx-3)] text-sm">
        No CTQ data available
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.criterion,
    'Pass Rate': item.pass_rate,
    'AI Agreement': item.ai_agreement,
  }));

  return (
    <div className="w-full h-full">
      {title && <h4 className="text-sm font-semibold text-[var(--tx-2)] mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis type="number" domain={[0, 100]} stroke="var(--tx-3)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            dataKey="name"
            type="category"
            stroke="var(--tx-2)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-s2)',
              borderRadius: '12px',
              border: '1px solid rgba(201,169,98,0.3)',
              color: 'var(--tx-1)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
            }}
            formatter={(value: any) => [`${Number(value).toFixed(1)}%`]}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-[var(--tx-2)] font-bold">{value}</span>
            )}
          />
          <Bar dataKey="Pass Rate" fill="var(--accent)" radius={[0, 6, 6, 0]} barSize={16} />
          <Bar dataKey="AI Agreement" fill="#34D399" radius={[0, 6, 6, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CTQBarChart;
