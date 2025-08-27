//--src/components/ui/toast.tsx
'use client';

import { toast as sonnerToast } from 'sonner';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void; };
}

interface ToastOptions extends ToastProps {
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  dismissible?: boolean;
}

export const toast = {
  success: (options: ToastOptions) => {
    return sonnerToast.success(options.title || 'Success', {
      description: options.description,
      duration: options.duration || 4000,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
      icon: <CheckCircle className="w-4 h-4" />,
      className: 'bg-green-50 border-green-200 text-green-800',
    });
  },

  error: (options: ToastOptions) => {
    return sonnerToast.error(options.title || 'Error', {
      description: options.description,
      duration: options.duration || 6000,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
      icon: <AlertCircle className="w-4 h-4" />,
      className: 'bg-red-50 border-red-200 text-red-800',
    });
  },

  info: (options: ToastOptions) => {
    return sonnerToast.info(options.title || 'Info', {
      description: options.description,
      duration: options.duration || 4000,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
      icon: <Info className="w-4 h-4" />,
      className: 'bg-blue-50 border-blue-200 text-blue-800',
    });
  },

  warning: (options: ToastOptions) => {
    return sonnerToast.warning(options.title || 'Warning', {
      description: options.description,
      duration: options.duration || 5000,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
      icon: <AlertCircle className="w-4 h-4" />,
      className: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    });
  },

  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },

  promise: <T,>(
    promise: Promise<T>,
    options: {
      loading: ToastOptions;
      success: (data: T) => ToastOptions;
      error: (error: any) => ToastOptions;
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading: options.loading.title || 'Loading...',
      success: (data) => {
        const successOptions = options.success(data);
        return successOptions.title || 'Success';
      },
      error: (error) => {
        const errorOptions = options.error(error);
        return errorOptions.title || 'Error';
      },
    });
  },
};

export default toast;