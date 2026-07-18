import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
  info: 'bg-blue-50 text-blue-700 border-blue-100',
  brand: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  neutral: 'bg-slate-50 text-slate-700 border-slate-100',
};

const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className }) => {
  return (
    <span className={clsx(
      'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-200',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};

export default Badge;
