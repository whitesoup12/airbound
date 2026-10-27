import React from 'react';
import {
  X,
  BookOpen,
  Award,
  Clock,
  Navigation,
  DollarSign,
  Package,
  Users,
  Calendar,
  Globe,
  Plane,
  Fuel
} from 'lucide-react';
import { formatLandingRating, getPilotRank } from '../utils/xpUtils.js';

export function LogbookModal({ isOpen, onClose, pilot }) {
  if (!isOpen) return null;

  const flightLog = pilot?.flight_log || [];
  const totalEarnings = flightLog.reduce((acc, f) => acc + (f.payout || 0), 0);
  const totalNm = flightLog.reduce((acc, f) => acc + (f.distance_nm || 0), 0);
  const totalDurationSec = flightLog.reduce((acc, f) => acc + (f.duration_seconds || 0), 0);

  const formatDuration = (sec) => {
    if (!sec || sec < 60) return `${sec || 0}s`;
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m ${sec % 60}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl glass-panel border border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono tracking-wide">
                OFFICIAL PILOT LOGBOOK
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Callsign: <strong className="text-cyan-400">{pilot?.callsign || 'James'}</strong> • MSFS 2024 Career Records
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Career Overview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-slate-900/40 border-b border-slate-800 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">FLIGHTS COMPLETED</span>
            <span className="text-xl font-bold text-white mt-1 block">{flightLog.length}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">CAREER REVENUE</span>
            <span className="text-xl font-bold text-emerald-400 mt-1 block">
              ${totalEarnings.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">TOTAL AIR MILES</span>
            <span className="text-xl font-bold text-cyan-400 mt-1 block">
              {Math.round(totalNm).toLocaleString()} NM
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">TIME IN FLIGHT</span>
            <span className="text-xl font-bold text-amber-400 mt-1 block">
              {formatDuration(totalDurationSec)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>CAREER XP</span>
              <Award className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-xl font-bold text-purple-300 mt-1 block">
              {(pilot?.xp || 0).toLocaleString()} XP
            </span>
          </div>
        </div>

        {/* Visited Badges Section */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400">Visited Airports ({pilot?.visited_airports?.length || 0}):</span>
            <div className="flex flex-wrap gap-1">
              {(pilot?.visited_airports || []).map((icao) => (
                <span
                  key={icao}
                  className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800 text-[11px]"
                >
                  {icao}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Countries ({pilot?.visited_countries?.length || 0}):</span>
            <div className="flex flex-wrap gap-1">
              {(pilot?.visited_countries || []).map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 text-[11px]"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Flight Records List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {flightLog.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="font-mono text-slate-400 text-sm">No completed flights logged yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Accept a contract job, fly to destination in MSFS 2024, and shut down engines to record your first entry!
              </p>
            </div>
          ) : (
            flightLog
              .slice()
              .reverse()
              .map((record, index) => (
                <div
                  key={record._id || index}
                  className="glass-panel p-4 rounded-xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-900 transition flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Route & Date */}
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center font-mono font-bold text-cyan-300">
                        #{flightLog.length - index}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 font-mono">
                          <span className="text-base font-bold text-white">{record.origin_icao}</span>
                          <span className="text-cyan-400">➔</span>
                          <span className="text-base font-bold text-white">{record.destination_icao}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[11px] text-slate-300">
                            {record.distance_nm} NM
                          </span>
                          {record.touchdown_fpm !== undefined && record.touchdown_fpm !== null && Math.abs(record.touchdown_fpm) > 0 ? (() => {
                            const rating = formatLandingRating(record.touchdown_fpm, record.landing_rating, {
                              category: record.category,
                              aircraftName: record.aircraft_name,
                              approachKts: record.approach_speed_kts,
                              landingClass: record.landing_class
                            });
                            return (
                              <span
                                className={`px-1.5 py-0.2 rounded border ${rating.badgeColor} text-[10px] inline-flex items-center space-x-1 font-mono`}
                                title={`${rating.fullLabel} (${Math.round(record.touchdown_fpm)} FPM) [${rating.aircraftClassLabel}]`}
                              >
                                <span>{rating.icon}</span>
                                <span>{Math.round(record.touchdown_fpm)} FPM</span>
                              </span>
                            );
                          })() : null}
                          <span className="px-1.5 py-0.2 rounded bg-purple-950/70 border border-purple-800/60 text-purple-300 text-[10px] inline-flex items-center space-x-0.5 font-mono">
                            <Award className="w-2.5 h-2.5 text-purple-400" />
                            <span>+{record.xp_earned || record.distance_nm || 0} XP</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>
                              {record.completed_at
                                ? new Date(record.completed_at).toLocaleDateString() +
                                  ' ' +
                                  new Date(record.completed_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'Recent'}
                            </span>
                          </span>
                          {record.duration_seconds > 0 && (
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{formatDuration(record.duration_seconds)}</span>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Payload & Payout */}
                    <div className="flex items-center space-x-4 font-mono text-xs w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex items-center space-x-3 text-slate-400">
                        <span className="flex items-center space-x-1">
                          <Package className="w-3.5 h-3.5 text-amber-400" />
                          <span>{record.cargo_lbs?.toLocaleString() || 0} lbs</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <span>{record.pax_count || 0} pax</span>
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-emerald-400 font-bold text-base flex items-center justify-end">
                          <DollarSign className="w-4 h-4 -mr-1" />
                          {(record.net_payout || record.payout)?.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase block">NET EARNINGS</span>
                      </div>
                    </div>
                  </div>

                  {/* Aircraft & Financial Ledger Strip */}
                  <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
                    <div className="flex items-center space-x-1 text-cyan-300">
                      <Plane className="w-3 h-3 text-cyan-400" />
                      <span>{record.aircraft_name || 'Cessna 152'}</span>
                    </div>

                    {record.gross_payout ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span>Gross: <strong className="text-slate-200">${record.gross_payout.toLocaleString()}</strong></span>
                        <span className="flex items-center space-x-1">
                          <Fuel className="w-3 h-3 text-amber-400" />
                          <span>Fuel: <strong className="text-amber-300">-${(record.fuel_cost || 0).toFixed(2)} ({record.fuel_gallons || 0} gal)</strong></span>
                        </span>
                        <span>Landing Fee: <strong className="text-rose-400">-${record.landing_fee || 0}</strong></span>
                        <span className="text-emerald-400 font-bold">
                          Net: +${(record.net_payout || record.payout).toLocaleString()}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs transition"
          >
            Close Logbook
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogbookModal;

