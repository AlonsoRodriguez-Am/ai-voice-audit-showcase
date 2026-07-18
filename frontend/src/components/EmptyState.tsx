import React from 'react';
import { clsx } from 'clsx';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => {
  return (
    <div className={clsx(
      "flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-slate-200 border-dashed",
      className
    )}>
      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-6 shadow-sm border border-slate-100">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm max-w-xs mx-auto mb-8 font-medium">
        {description}
      </p>
      {action && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
