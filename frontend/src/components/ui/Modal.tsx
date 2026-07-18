import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    full: 'max-w-[95vw] h-[95vh]'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm dark:bg-black/70">
      <div 
        className={cn(
          "bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col",
          sizes[size],
          className
        )}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          {title && <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>}
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-auto"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className={cn("overflow-y-auto p-6", size === 'full' && "flex-1")}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
