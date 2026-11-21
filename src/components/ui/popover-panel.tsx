import type { ReactNode } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

export interface PopoverPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function PopoverPanel({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'start',
  className,
}: PopoverPanelProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-md focus:outline-none',
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
