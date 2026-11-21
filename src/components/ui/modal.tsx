import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-5 shadow-lg focus:outline-none max-h-[90dvh] overflow-y-auto',
            maxWidthClass,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-slate-900">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-xs text-slate-500">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Fechar janela"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="mt-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
