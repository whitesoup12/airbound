import React, { useState } from 'react';
import { Lock, ShieldAlert, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { verifyPasscode, setStoredPasscode } from '../api/client';

export function CockpitLockModal({ isOpen, onSuccess }) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Please enter your Pilot Passcode.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await verifyPasscode(passcode.trim());
      if (res.success) {
        setStoredPasscode(passcode.trim());
        if (onSuccess) {
          onSuccess(passcode.trim());
        }
      } else {
        setError(res.error || 'Access Denied: Invalid Passcode');
      }
    } catch (err) {
      setError(err.message || 'Access Denied: Invalid Passcode');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickKey = (num) => {
    setPasscode((prev) => prev + num);
  };

  const handleBackspace = () => {
    setPasscode((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPasscode('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden shadow-cyan-950/40">
        {/* Header Banner */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-cyan-300 font-mono">
                Cockpit Authorization
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Airbound Flight Deck Security</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/40 bg-amber-950/40 text-amber-300">
            RESTRICTED
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            This Airbound career tracker is protected. Enter your Pilot Passcode to authorize this device for flight dispatch, fleet hangar, and telemetry syncing.
          </p>

          {error && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-mono">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span>Pilot Passcode</span>
                <span className="text-slate-500">Device will remember</span>
              </label>

              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setError(null);
                  }}
                  autoFocus
                  placeholder="Enter passcode..."
                  className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl font-mono text-center tracking-widest text-lg text-white placeholder-slate-600 outline-none transition"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  title={showPasscode ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Aviation Touch Keypad (Convenient for Cockpit Tablets & iPads) */}
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleQuickKey(String(num))}
                  className="py-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-200 text-base font-bold transition active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="py-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 text-xs font-semibold transition active:scale-95"
              >
                CLR
              </button>
              <button
                type="button"
                onClick={() => handleQuickKey('0')}
                className="py-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-200 text-base font-bold transition active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 text-xs font-semibold transition active:scale-95"
              >
                DEL
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !passcode}
              className="w-full py-3 px-4 rounded-xl font-mono text-sm font-bold tracking-wider uppercase transition flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-600/20"
            >
              {isLoading ? (
                <span>VERIFYING AUTHORIZATION...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>AUTHORIZE FLIGHT DECK</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CockpitLockModal;
