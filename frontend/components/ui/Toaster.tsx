"use client";

import { useToast } from "@/hooks/useToast";
import { CheckCircle2, XCircle, Info } from "lucide-react";

export function Toaster() {
  const { toasts, toast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl p-4 rounded-xl min-w-[300px] animate-in slide-in-from-bottom-5 fade-in-0"
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
          {t.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
          {t.type === 'info' && <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />}
          <p className="text-sm font-medium text-white flex-1">{t.message}</p>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
