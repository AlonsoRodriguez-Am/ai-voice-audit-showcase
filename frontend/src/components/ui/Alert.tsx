import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from './Button';

export interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className
}) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  const variants = {
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />,
    info: <Info className="w-5 h-5 text-blue-500 dark:text-blue-400" />
  };

  return (
    <div className={cn("p-4 rounded-xl border flex items-start gap-3", variants[type], className)}>
      <div className="flex-shrink-0 mt-0.5">
        {icons[type]}
      </div>
      <div className="flex-1">
        {title && <h3 className="text-sm font-bold mb-1">{title}</h3>}
        <div className="text-sm">
          {children}
        </div>
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-lg focus:ring-2 focus:ring-offset-2 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 opacity-70" />
        </button>
      )}
    </div>
  );
};

export default Alert;
