import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ButtonTone = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'emerald';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const TONE_CLASSES: Record<ButtonTone, string> = {
  primary: 'bg-blue-600 text-white border border-blue-700/20 hover:bg-blue-700',
  secondary: 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200/80',
  outline: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'bg-transparent text-slate-700 border border-transparent hover:bg-slate-100 hover:text-slate-950',
  danger: 'bg-red-600 text-white border border-red-700/20 hover:bg-red-700',
  emerald: 'bg-emerald-600 text-white border border-emerald-700/20 hover:bg-emerald-700',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
  icon: 'h-8 w-8 p-0 justify-center',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  tone = 'primary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
