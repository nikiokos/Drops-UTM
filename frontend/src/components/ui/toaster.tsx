'use client';

import { useToast, type ToasterToast } from '@/hooks/use-toast';
import { Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:flex-col md:max-w-[420px]">
      {toasts.map((t: ToasterToast) => (
        <Toast key={t.id} variant={t.variant} onClose={() => dismiss(t.id)}>
          {t.title && <ToastTitle>{t.title}</ToastTitle>}
          {t.description && <ToastDescription>{t.description}</ToastDescription>}
        </Toast>
      ))}
    </div>
  );
}
