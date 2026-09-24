import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface Toast {
  id: string
  message: string
}

interface ToastContextType {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Top-Center Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            id="toast-notification"
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-emerald-200/90 bg-emerald-50/95 px-4 py-1.5 text-xs font-medium text-emerald-800 shadow-sm backdrop-blur-xs transition-all duration-300 animate-in fade-in slide-in-from-top-2"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
