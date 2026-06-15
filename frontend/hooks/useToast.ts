import { useState, useEffect } from 'react';

export type ToastMessage = {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
};

let toasts: ToastMessage[] = [];
let listeners: ((toasts: ToastMessage[]) => void)[] = [];

const notifyListeners = () => {
  listeners.forEach(l => l([...toasts]));
};

export const toast = {
  success: (message: string, options?: { duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9);
    toasts.push({ id, type: 'success', message, duration: options?.duration });
    notifyListeners();
    setTimeout(() => toast.dismiss(id), options?.duration || 5000);
  },
  error: (message: string, options?: { duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9);
    toasts.push({ id, type: 'error', message, duration: options?.duration });
    notifyListeners();
    setTimeout(() => toast.dismiss(id), options?.duration || 5000);
  },
  info: (message: string, options?: { duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9);
    toasts.push({ id, type: 'info', message, duration: options?.duration });
    notifyListeners();
    setTimeout(() => toast.dismiss(id), options?.duration || 5000);
  },
  dismiss: (id: string) => {
    toasts = toasts.filter(t => t.id !== id);
    notifyListeners();
  }
};

export function useToast() {
  const [currentToasts, setCurrentToasts] = useState<ToastMessage[]>(toasts);

  useEffect(() => {
    listeners.push(setCurrentToasts);
    return () => {
      listeners = listeners.filter(l => l !== setCurrentToasts);
    };
  }, []);

  return { toasts: currentToasts, toast };
}
