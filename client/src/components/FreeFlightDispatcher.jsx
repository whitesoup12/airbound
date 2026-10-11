import React, { useState } from 'react';
import {
  Globe,
  DollarSign,
  AlertCircle,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';

export function FreeFlightDispatcher({
  activeJob = null,
  onStartFreeFlight,
  onCancelFreeFlight,
  loading = false
}) {
  const [deductFees, setDeductFees] = useState(false); // Default OFF per user specification
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleCommenceFlight = async () => {
    setErrorMsg(null);
    try {
      setIsSubmitting(true);
      await onStartFreeFlight({
        destination_icao: null,
        deduct_fees: deductFees
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start Free Flight');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentFreeFlight = Boolean(activeJob?.is_free_flight);
  const isCommercialActive = Boolean(activeJob && !activeJob.is_free_flight);

  return (
    <div className="glass-panel rounded-3xl p-5 sm:p-7 border border-slate-800 bg-slate-900/60 shadow-2xl space-y-6 font-mono">
      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase">
                FREE FLIGHT DISPATCHER
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold">
                OPEN ROAM MODE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fly any aircraft in MSFS from anywhere to anywhere. Touchdown and engine shutdown will automatically detect your arrival airfield and record your landing rate, flight time, and career XP.
            </p>
          </div>
        </div>

        {isCurrentFreeFlight && (
          <button
            onClick={onCancelFreeFlight}
            className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 text-xs font-bold transition flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>CANCEL FREE FLIGHT</span>
          </button>
        )}
      </div>

      {/* Warning if Commercial Contract is currently in progress */}
      {isCommercialActive && (
        <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-800/80 text-amber-200 text-xs flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block uppercase tracking-wide">
              Commercial Contract In Progress
            </span>
            <span className="text-slate-300">
              You are currently flying a contracted job ({activeJob.origin_icao} ➔ {activeJob.destination_icao}). Complete or cancel this mission before commencing a Free Flight.
            </span>
          </div>
        </div>
      )}

      {/* Active Free Flight Notification Card */}
      {isCurrentFreeFlight && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/80 text-cyan-200 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <span className="font-bold block text-sm text-white">
                OPEN ROAM FLIGHT ACTIVE ({activeJob.origin_icao} ➔ Auto-Detect Airfield)
              </span>
              <span className="text-slate-400 text-[11px]">
                Status: Tracking in progress • Take off and land anywhere. Touchdown vertical speed and landing airfield will be recorded automatically upon engine shutdown.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Financial Expense Settlement Toggle */}
      <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase text-slate-400 font-bold flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>EXPENSE SETTLEMENT</span>
          </span>

          {/* Toggle Switch */}
          <button
            type="button"
            onClick={() => setDeductFees(!deductFees)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
              deductFees ? 'bg-emerald-600' : 'bg-slate-800 border border-slate-700'
            }`}
            role="switch"
            aria-checked={deductFees}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                deductFees ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className={`font-bold text-sm ${deductFees ? 'text-emerald-400' : 'text-cyan-400'}`}>
            {deductFees ? 'Realistic Expenses Active' : 'Casual / Free Mode ($0 Cost)'}
          </span>
        </div>

        <p className="text-xs text-slate-400">
          {deductFees
            ? 'Fuel burned and landing fees at the arrival airfield will be settled and deducted from your pilot wallet upon engine shutdown.'
            : 'Fuel and landing fees are completely waived ($0 expense). Pure leisure flying.'}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Action Button */}
      {!isCurrentFreeFlight && (
        <button
          onClick={handleCommenceFlight}
          disabled={loading || isSubmitting || isCommercialActive}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold tracking-wide uppercase transition flex items-center justify-center space-x-2 shadow-xl ${
            isCommercialActive
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-cyan-950/60 cursor-pointer active:scale-[0.99]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-cyan-200" />
          <span>
            {isSubmitting ? 'COMMENCING FREE FLIGHT...' : 'COMMENCE FREE FLIGHT (OPEN ROAM)'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default FreeFlightDispatcher;
