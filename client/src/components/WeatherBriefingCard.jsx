import React, { useState, useEffect } from 'react';
import {
  Wind,
  Compass,
  Cloud,
  Eye,
  Gauge,
  Thermometer,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Plane,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { fetchAirportWeather } from '../api/client.js';

function getCategoryTheme(cat = 'VFR') {
  switch ((cat || '').toUpperCase()) {
    case 'LIFR':
      return {
        badge: 'bg-purple-500/25 text-purple-300 border-purple-500/60 shadow-purple-950/50',
        dot: 'bg-purple-400',
        label: 'LIFR',
        fullLabel: 'Low IFR (< 500 ft / < 1 mi)'
      };
    case 'IFR':
      return {
        badge: 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-amber-950/50',
        dot: 'bg-amber-400',
        label: 'IFR',
        fullLabel: 'IFR (500–1,000 ft / 1–3 mi)'
      };
    case 'MVFR':
      return {
        badge: 'bg-blue-500/25 text-blue-300 border-blue-500/60 shadow-blue-950/50',
        dot: 'bg-blue-400',
        label: 'MVFR',
        fullLabel: 'Marginal VFR (1,000–3,000 ft / 3–5 mi)'
      };
    case 'VFR':
    default:
      return {
        badge: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-emerald-950/50',
        dot: 'bg-emerald-400',
        label: 'VFR',
        fullLabel: 'VFR (> 3,000 ft / > 5 mi)'
      };
  }
}

export function WeatherBriefingCard({
  icao,
  airportName = '',
  type = 'arrival', // 'departure' | 'arrival' | 'general'
  compact = false,
  showAllRunwaysDefault = false,
  onOpenCharts = null
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllRunways, setShowAllRunways] = useState(showAllRunwaysDefault);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!icao) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchAirportWeather(icao)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn(`[WeatherBriefing] Could not load weather for ${icao}:`, err.message);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [icao]);

  if (!icao) return null;

  const metar = data?.metar;
  const recommendedRunway = data?.recommendedRunway;
  const allRunways = data?.allRunways || [];
  const fltCat = metar?.fltCat || 'VFR';
  const theme = getCategoryTheme(fltCat);
  const wind = metar?.wind;

  // Compact Mode: sleek horizontal banner
  if (compact) {
    if (loading) {
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 font-mono text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>Loading METAR ({icao})...</span>
        </div>
      );
    }

    if (!metar || !metar.hasMetar) {
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 font-mono text-xs">
          <Wind className="w-3.5 h-3.5 text-slate-500" />
          <span>{icao}: No Live METAR</span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-xs shadow-sm">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 ${theme.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`} />
          <span>{theme.label}</span>
        </span>

        <span className="text-slate-300 flex items-center space-x-1">
          <Wind className="w-3 h-3 text-cyan-400" />
          <span>{wind?.label || 'Winds N/A'}</span>
        </span>

        {metar.altimeter?.inHg && (
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            A{metar.altimeter.inHg}
          </span>
        )}

        {recommendedRunway && (
          <div className="flex items-center space-x-1 pl-2 border-l border-slate-800 text-emerald-300">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              {type === 'departure' ? 'DEP RWY:' : 'ARR RWY:'}
            </span>
            <span className="font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/80 text-[11px]">
              {recommendedRunway.ident}
            </span>
            <span className="text-[10px] text-slate-400">
              ({recommendedRunway.headwindKts}kt HW{recommendedRunway.crosswindKts > 0 ? `, ${recommendedRunway.crosswindKts}kt XW` : ''})
            </span>
          </div>
        )}
      </div>
    );
  }

  // Full Card Mode
  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 bg-slate-900/70 shadow-xl space-y-3 font-mono text-xs animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white text-sm tracking-wide">
                {icao} {type === 'departure' ? 'DEPARTURE WEATHER' : type === 'arrival' ? 'DESTINATION WEATHER' : 'METAR BRIEFING'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 ${theme.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`} />
                <span>{theme.label}</span>
              </span>
            </div>
            {airportName && (
              <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                {airportName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenCharts && (
            <button
              type="button"
              onClick={() => onOpenCharts(icao, airportName)}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-[11px] flex items-center space-x-1 transition cursor-pointer"
              title="Open charts and plates for this airfield"
            >
              <FileText className="w-3 h-3 text-cyan-400" />
              <span>CHARTS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 text-[10px] transition cursor-pointer"
            title="Toggle Raw METAR text"
          >
            {showRaw ? 'DECODED' : 'RAW METAR'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Fetching live NOAA METAR observation...</span>
        </div>
      ) : error || !metar?.hasMetar ? (
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 flex items-center justify-between">
          <span>No live METAR observation reported for {icao}. (Estimated VFR conditions)</span>
        </div>
      ) : showRaw ? (
        /* Raw METAR view */
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px] leading-relaxed break-all select-all">
          {metar.raw}
        </div>
      ) : (
        /* Decoded Grid */
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* Wind Box */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block mb-0.5">SURFACE WIND</span>
              <div className="flex items-center space-x-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-white font-bold truncate">
                  {wind?.label || 'Calm'}
                </span>
              </div>
            </div>

            {/* Altimeter Box */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block mb-0.5">ALTIMETER / QNH</span>
              <div className="flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-white font-bold">
                  {metar.altimeter?.inHg ? `${metar.altimeter.inHg} inHg` : '--'}
                </span>
                <span className="text-[10px] text-slate-400">({metar.altimeter?.hPa} hPa)</span>
              </div>
            </div>

            {/* Visibility Box */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block mb-0.5">VISIBILITY</span>
              <div className="flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-white font-bold">
                  {metar.visibilitySm ? `${metar.visibilitySm} SM` : '10+ SM'}
                </span>
              </div>
            </div>

            {/* Temp & Dewpoint */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block mb-0.5">TEMP / DEWPOINT</span>
              <div className="flex items-center space-x-1.5">
                <Thermometer className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-white font-bold">
                  {metar.tempC !== null ? `${metar.tempC}°C` : '--'}
                </span>
                <span className="text-slate-400 text-[10px]">
                  ({metar.dewpC !== null ? `${metar.dewpC}°C` : '--'})
                </span>
              </div>
            </div>
          </div>

          {/* Recommended Runway Banner */}
          {recommendedRunway ? (
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/50 via-slate-950/80 to-slate-950/60 border border-emerald-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-900/60 border border-emerald-600/70 flex items-center justify-center text-emerald-300 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      {type === 'departure' ? 'RECOMMENDED TAKEOFF RUNWAY:' : 'RECOMMENDED LANDING RUNWAY:'}
                    </span>
                    <span className="text-sm font-bold text-emerald-300 font-mono">
                      RWY {recommendedRunway.ident}
                    </span>
                    <span className="text-[11px] text-slate-300">
                      ({recommendedRunway.heading.toString().padStart(3, '0')}°)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-300 mt-0.5">
                    <span>
                      Headwind: <strong className="text-emerald-400">{recommendedRunway.headwindKts} KTS</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Crosswind: <strong className={recommendedRunway.crosswindKts > 10 ? 'text-amber-400' : 'text-slate-200'}>
                        {recommendedRunway.crosswindKts} KTS
                        {recommendedRunway.crosswindDirection === 'left' ? ' (Left)' : recommendedRunway.crosswindDirection === 'right' ? ' (Right)' : ''}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>Length: <strong>{recommendedRunway.lengthFt?.toLocaleString()} FT</strong></span>
                  </div>
                </div>
              </div>

              {allRunways.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllRunways(!showAllRunways)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] flex items-center space-x-1 transition self-end sm:self-auto cursor-pointer"
                >
                  <span>All Runways ({allRunways.length})</span>
                  {showAllRunways ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-center">
              No specific runway data available for this airfield.
            </div>
          )}

          {/* All Runways Breakdown Table */}
          {showAllRunways && allRunways.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-fadeIn">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                ALL RUNWAY ENDS WIND ANALYSIS ({icao})
              </span>
              <div className="overflow-x-auto max-h-48 custom-scrollbar">
                <table className="w-full text-[11px] text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800 text-[10px]">
                      <th className="py-1 px-2">RUNWAY</th>
                      <th className="py-1 px-2">HDG</th>
                      <th className="py-1 px-2">LENGTH</th>
                      <th className="py-1 px-2">HEADWIND</th>
                      <th className="py-1 px-2">CROSSWIND</th>
                      <th className="py-1 px-2 text-right">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {allRunways.map((r, idx) => {
                      const isBest = recommendedRunway?.ident === r.ident;
                      const hasTailwind = r.tailwindKts > 0;

                      return (
                        <tr
                          key={`${r.ident}-${idx}`}
                          className={`hover:bg-slate-900/60 transition ${
                            isBest ? 'bg-emerald-950/30 text-emerald-300 font-bold' : ''
                          }`}
                        >
                          <td className="py-1.5 px-2 font-bold flex items-center space-x-1">
                            {isBest && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                            <span>RWY {r.ident}</span>
                          </td>
                          <td className="py-1.5 px-2 text-slate-400">
                            {r.heading.toString().padStart(3, '0')}°
                          </td>
                          <td className="py-1.5 px-2 text-slate-300">
                            {r.lengthFt?.toLocaleString()} FT
                          </td>
                          <td className="py-1.5 px-2">
                            {r.closed ? (
                              <span className="text-slate-600">--</span>
                            ) : hasTailwind ? (
                              <span className="text-rose-400 font-semibold">{r.tailwindKts} kt TW ⚠️</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">{r.headwindKts} kt HW</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            {r.closed ? (
                              <span className="text-slate-600">--</span>
                            ) : (
                              <span className={r.crosswindKts > 12 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                                {r.crosswindKts} kt {r.crosswindDirection === 'left' ? 'L' : r.crosswindDirection === 'right' ? 'R' : ''}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {r.closed ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950/80 text-rose-300 border border-rose-800">
                                CLOSED
                              </span>
                            ) : isBest ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold">
                                BEST RUNWAY
                              </span>
                            ) : hasTailwind ? (
                              <span className="text-rose-400 text-[10px]">Unfavorable</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Usable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WeatherBriefingCard;
