import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-xs font-medium text-slate-700 leading-tight', className)}
      {...props}
    />
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[88px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
