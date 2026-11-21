import type { ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export interface TabsNavProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  children: ReactNode;
}

export function TabsNav({ value, onValueChange, items, children }: TabsNavProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List
        aria-label="Navegação principal"
        className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1"
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-all',
              'hover:text-slate-900',
              'data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-xs',
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span className="ml-0.5 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-slate-700">
                {item.badge}
              </span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export const TabPanel = TabsPrimitive.Content;
