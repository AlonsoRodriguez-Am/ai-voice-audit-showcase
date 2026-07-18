import React from 'react';
import { cn } from './Button';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
  sortable?: boolean;
  sortKey?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  onSort?: (key: string) => void;
  sortDirection?: 'asc' | 'desc' | null;
  sortColumn?: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

function Table<T>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortDirection,
  sortColumn,
  isLoading,
  emptyMessage = "No data available",
  className
}: TableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm", className)}>
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-gray-800">
          <tr>
            {columns.map((col, idx) => (
              <th 
                key={idx} 
                className={cn(
                  "px-6 py-4 whitespace-nowrap", 
                  col.sortable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                  col.className
                )}
                onClick={() => col.sortable && col.sortKey && onSort?.(col.sortKey)}
              >
                <div className="flex items-center gap-2">
                  {col.header}
                  {col.sortable && col.sortKey === sortColumn && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={cn("px-6 py-4", col.className)}>
                    {typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
