import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface DistributionItem {
  name: string;
  count: number;
}

interface DistributionPieChartProps {
  data: DistributionItem[];
  title?: string;
}

// Gold, Teal, Emerald, Amber, Purple, Muted Accent colors
const COLORS = [
  '#C9A962', '#34D399', '#3b82f6', '#FBBF24', '#a78bfa',
  '#f43f5e', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
];

const DistributionPieChart = ({ data, title }: DistributionPieChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--tx-3)] text-sm">
        No distribution data available
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="w-full h-full">
      {title && <h4 className="text-sm font-semibold text-[var(--tx-2)] mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={3}
            dataKey="count"
            nameKey="name"
            strokeWidth={0}
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-s2)',
              borderRadius: '12px',
              border: '1px solid rgba(201,169,98,0.3)',
              color: 'var(--tx-1)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
            }}
            formatter={(value: any, name: any) => [
              `${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-[var(--tx-2)] font-semibold">{value}</span>
            )}
          />
          {/* Center label */}
          <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold" fill="var(--tx-1)">
            {total}
          </text>
          <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold" fill="var(--tx-3)">
            Total
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DistributionPieChart;
