import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export interface SwitchControlProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export function SwitchControl({
  id,
  checked,
  onCheckedChange,
  ariaLabel,
  disabled,
}: SwitchControlProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-blue-600' : 'bg-slate-300',
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-xs transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
