import React, { useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Info,
  X,
  Loader2,
  Plane
} from 'lucide-react';

export function DialogModal({
  isOpen,
  title = 'Confirmation',
  message,
  details,
  type = 'confirm', // 'confirm' | 'danger' | 'warning' | 'info' | 'success'
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  onClose,
  loading = false
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (onCancel) onCancel();
        else if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      if (onCancel) onCancel();
      else if (onClose) onClose();
    }
  };

  const getTheme = () => {
    switch (type) {
      case 'danger':
        return {
          icon: AlertTriangle,
          iconColor: 'text-rose-400',
          iconBg: 'bg-rose-500/20 border-rose-500/40',
          cardBorder: 'border-rose-500/40 shadow-rose-950/60',
          confirmBtn: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950/50'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          iconColor: 'text-amber-400',
          iconBg: 'bg-amber-500/20 border-amber-500/40',
          cardBorder: 'border-amber-500/40 shadow-amber-950/60',
          confirmBtn: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-amber-950/50'
        };
      case 'success':
        return {
          icon: CheckCircle2,
          iconColor: 'text-emerald-400',
          iconBg: 'bg-emerald-500/20 border-emerald-500/40',
          cardBorder: 'border-emerald-500/40 shadow-emerald-950/60',
          confirmBtn: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold shadow-emerald-950/50'
        };
      case 'info':
        return {
          icon: Info,
          iconColor: 'text-cyan-400',
          iconBg: 'bg-cyan-500/20 border-cyan-500/40',
          cardBorder: 'border-cyan-500/40 shadow-cyan-950/60',
          confirmBtn: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold shadow-cyan-950/50'
        };
      case 'confirm':
      default:
        return {
          icon: HelpCircle,
          iconColor: 'text-cyan-400',
          iconBg: 'bg-cyan-500/20 border-cyan-500/40',
          cardBorder: 'border-cyan-500/40 shadow-cyan-950/60',
          confirmBtn: 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold shadow-cyan-950/50'
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.icon;

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className={`relative w-full max-w-md bg-[#0e131f] border ${theme.cardBorder} rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp`}>
        {/* Header */}
        <div className="p-5 pb-3 flex items-start justify-between border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl ${theme.iconBg} border flex items-center justify-center ${theme.iconColor} shadow-md shrink-0`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide">
                {title}
              </h3>
            </div>
          </div>
          {(onCancel || onClose) && (
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
                else if (onClose) onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3 font-mono text-xs">
          {message && (
            <div className="text-slate-200 leading-relaxed text-[13px]">
              {message}
            </div>
          )}

          {details && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-slate-400 text-[11px] leading-relaxed break-words">
              {details}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-end space-x-2.5">
          {cancelText && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (onCancel) onCancel();
                else if (onClose) onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}

          {confirmText && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (onConfirm) onConfirm();
                else if (onClose) onClose();
              }}
              className={`px-5 py-2 rounded-xl font-mono text-xs font-bold transition flex items-center space-x-1.5 shadow-lg cursor-pointer disabled:opacity-50 ${theme.confirmBtn}`}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{confirmText}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DialogModal;
