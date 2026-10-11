import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Gauge,
  Award,
  Search,
  ArrowUpDown,
  Plane,
  Calendar,
  Clock,
  Navigation,
  Sparkles,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { formatLandingRating } from '../utils/xpUtils.js';

const CATEGORY_CONFIG = {
  ALL: {
    label: 'All Recorded Landings',
    subLabel: 'All captured touchdown telemetry across your career',
    icon: '🛬',
    color: 'text-cyan-400',
    badgeColor: 'bg-cyan-950/60 border-cyan-800/80 text-cyan-300',
    borderColor: 'border-cyan-500',
    activeTab: 'bg-cyan-500/20 border-cyan-500/80 text-cyan-300',
    accentBg: 'bg-cyan-950/30'
  },
  Butter: {
    label: 'Butter / Greaser',
    subLabel: 'Silky smooth touchdowns meeting peak class criteria (+100 XP)',
    icon: '🧈',
    color: 'text-emerald-400',
    badgeColor: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300',
    borderColor: 'border-emerald-500',
    activeTab: 'bg-emerald-500/20 border-emerald-500/80 text-emerald-300',
    accentBg: 'bg-emerald-950/30'
  },
  Clean: {
    label: 'Clean Landing',
    subLabel: 'Standard, gentle touchdowns meeting class limits (+50 XP)',
    icon: '✈️',
    color: 'text-cyan-400',
    badgeColor: 'bg-cyan-950/60 border-cyan-800/80 text-cyan-300',
    borderColor: 'border-cyan-500',
    activeTab: 'bg-cyan-500/20 border-cyan-500/80 text-cyan-300',
    accentBg: 'bg-cyan-950/30'
  },
  Firm: {
    label: 'Firm Landing',
    subLabel: 'Positive plant touchdowns with no structural penalty (0 XP)',
    icon: '⚡',
    color: 'text-amber-400',
    badgeColor: 'bg-amber-950/60 border-amber-800/80 text-amber-300',
    borderColor: 'border-amber-500',
    activeTab: 'bg-amber-500/20 border-amber-500/80 text-amber-300',
    accentBg: 'bg-amber-950/30'
  },
  Hard: {
    label: 'Hard Landing',
    subLabel: 'Exceeds normal descent rates, inducing airframe stress (-50 XP)',
    icon: '⚠️',
    color: 'text-orange-400',
    badgeColor: 'bg-orange-950/60 border-orange-800/80 text-orange-300',
    borderColor: 'border-orange-500',
    activeTab: 'bg-orange-500/20 border-orange-500/80 text-orange-300',
    accentBg: 'bg-orange-950/30'
  },
  Severe: {
    label: 'Severe Impact',
    subLabel: 'Hard impact exceeding airframe safety limits (-100 XP)',
    icon: '💥',
    color: 'text-rose-400',
    badgeColor: 'bg-rose-950/60 border-rose-800/80 text-rose-300',
    borderColor: 'border-rose-500',
    activeTab: 'bg-rose-500/20 border-rose-500/80 text-rose-300',
    accentBg: 'bg-rose-950/30'
  }
};

export function LandingCategoryModal({
  isOpen,
  onClose,
  initialCategory = 'ALL',
  flightLog = [],
  allAirports = [],
  onSwitchToLogbook
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'fpm-softest' | 'fpm-hardest'

  // Update active category if initialCategory changes upon opening
  useEffect(() => {
    if (isOpen && initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lookup map for airport names & cities
  const airportMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(allAirports)) {
      for (const a of allAirports) {
        if (a?.icao) map.set(a.icao.toUpperCase(), a);
      }
    }
    return map;
  }, [allAirports]);

  const getAirportName = (icao) => {
    if (!icao) return '';
    return airportMap.get(icao.toUpperCase())?.name || icao;
  };

  const getAirportCity = (icao) => {
    if (!icao) return '';
    return airportMap.get(icao.toUpperCase())?.city || '';
  };

  // Extract and format all recorded landings from flightLog
  const recordedLandings = useMemo(() => {
    const list = [];
    for (const f of flightLog) {
      if (f.touchdown_fpm !== null && f.touchdown_fpm !== undefined) {
        const fpm = Number(f.touchdown_fpm);
        const absFpm = Math.abs(Math.round(fpm));
        if (absFpm === 0) continue;

        const ratingInfo = formatLandingRating(fpm, f.landing_rating, {
          category: f.category,
          aircraftName: f.aircraft_name,
          approachKts: f.approach_speed_kts,
          landingClass: f.landing_class
        });

        list.push({
          id: f._id || f.flight_id || `${f.completed_at}-${f.destination_icao}`,
          rawFlight: f,
          fpm,
          absFpm,
          ratingInfo,
          categoryKey: ratingInfo.label, // 'Butter' | 'Clean' | 'Firm' | 'Hard' | 'Severe'
          origin_icao: f.origin_icao || '—',
          destination_icao: f.destination_icao || '—',
          aircraft_name: f.aircraft_name || 'Unknown Aircraft',
          tail_number: f.tail_number || '',
          approach_speed_kts: f.approach_speed_kts != null ? Math.round(f.approach_speed_kts) : null,
          completed_at: f.completed_at ? new Date(f.completed_at) : null,
          distance_nm: f.distance_nm ? Math.round(f.distance_nm) : null,
          duration_seconds: f.duration_seconds || f.airborne_seconds || 0,
          xp_earned: f.xp_earned || 0
        });
      }
    }
    return list;
  }, [flightLog]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts = { ALL: 0, Butter: 0, Clean: 0, Firm: 0, Hard: 0, Severe: 0 };
    for (const item of recordedLandings) {
      counts.ALL++;
      if (counts[item.categoryKey] !== undefined) {
        counts[item.categoryKey]++;
      }
    }
    return counts;
  }, [recordedLandings]);

  // Filtered list based on activeCategory and searchQuery
  const filteredLandings = useMemo(() => {
    let result = recordedLandings.filter((item) => {
      if (activeCategory !== 'ALL' && item.categoryKey !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const originIcao = item.origin_icao.toLowerCase();
        const destIcao = item.destination_icao.toLowerCase();
        const aircraft = item.aircraft_name.toLowerCase();
        const destCity = getAirportCity(item.destination_icao).toLowerCase();
        const originCity = getAirportCity(item.origin_icao).toLowerCase();
        const destName = getAirportName(item.destination_icao).toLowerCase();

        return (
          originIcao.includes(q) ||
          destIcao.includes(q) ||
          aircraft.includes(q) ||
          destCity.includes(q) ||
          originCity.includes(q) ||
          destName.includes(q)
        );
      }
      return true;
    });

    // Sort result
    result.sort((a, b) => {
      if (sortMode === 'date-desc') {
        return (b.completed_at?.getTime() || 0) - (a.completed_at?.getTime() || 0);
      }
      if (sortMode === 'date-asc') {
        return (a.completed_at?.getTime() || 0) - (b.completed_at?.getTime() || 0);
      }
      if (sortMode === 'fpm-softest') {
        return a.absFpm - b.absFpm;
      }
      if (sortMode === 'fpm-hardest') {
        return b.absFpm - a.absFpm;
      }
      return 0;
    });

    return result;
  }, [recordedLandings, activeCategory, searchQuery, sortMode, airportMap]);

  // Summary statistics for the current activeCategory
  const categoryStats = useMemo(() => {
    const subset =
      activeCategory === 'ALL'
        ? recordedLandings
        : recordedLandings.filter((i) => i.categoryKey === activeCategory);

    if (subset.length === 0) {
      return { count: 0, bestFpm: null, avgFpm: null, totalXp: 0 };
    }

    let totalFpm = 0;
    let best = subset[0];
    let totalXp = 0;

    for (const item of subset) {
      totalFpm += item.absFpm;
      totalXp += item.ratingInfo.bonusXp || 0;
      if (item.absFpm < best.absFpm) {
        best = item;
      }
    }

    return {
      count: subset.length,
      bestFpm: best.fpm,
      bestAirport: best.destination_icao,
      bestAircraft: best.aircraft_name,
      avgFpm: Math.round(totalFpm / subset.length),
      totalXp
    };
  }, [recordedLandings, activeCategory]);

  const currentConfig = CATEGORY_CONFIG[activeCategory] || CATEGORY_CONFIG.ALL;

  const formatDate = (date) => {
    if (!date) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    } catch {
      return String(date);
    }
  };

  const formatDuration = (sec) => {
    if (!sec || sec < 60) return `${sec || 0}s`;
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl glass-panel border border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden font-mono">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border ${currentConfig.badgeColor}`}
            >
              <span>{currentConfig.icon}</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase">
                  {currentConfig.label}
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${currentConfig.badgeColor}`}
                >
                  {categoryStats.count} {categoryStats.count === 1 ? 'Landing' : 'Landings'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {currentConfig.subLabel}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition border border-transparent hover:border-slate-700"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills Strip */}
        <div className="flex items-center space-x-2 p-3 sm:px-6 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto scrollbar-thin">
          {[
            { key: 'ALL', label: 'All', icon: '📋' },
            { key: 'Butter', label: 'Butter', icon: '🧈' },
            { key: 'Clean', label: 'Clean', icon: '✈️' },
            { key: 'Firm', label: 'Firm', icon: '⚡' },
            { key: 'Hard', label: 'Hard', icon: '⚠️' },
            { key: 'Severe', label: 'Severe', icon: '💥' }
          ].map((cat) => {
            const count = categoryCounts[cat.key] || 0;
            const isSelected = activeCategory === cat.key;
            const cfg = CATEGORY_CONFIG[cat.key];

            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                  isSelected
                    ? cfg.activeTab
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:px-6 bg-slate-950/60 border-b border-slate-800/60 text-xs">
          <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">TOTAL IN CATEGORY</span>
            <span className="text-xl font-bold text-white mt-0.5 block">
              {categoryStats.count}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">SOFTEST TOUCHDOWN</span>
            <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
              {categoryStats.bestFpm !== null ? `${categoryStats.bestFpm} FPM` : '—'}
            </span>
            {categoryStats.bestAirport && (
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                at {categoryStats.bestAirport}
              </span>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">AVERAGE VERTICAL SPEED</span>
            <span className="text-xl font-bold text-cyan-300 mt-0.5 block">
              {categoryStats.avgFpm !== null ? `-${categoryStats.avgFpm} FPM` : '—'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">CATEGORY XP BALANCE</span>
            <span
              className={`text-xl font-bold mt-0.5 block ${
                categoryStats.totalXp > 0
                  ? 'text-emerald-400'
                  : categoryStats.totalXp < 0
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {categoryStats.totalXp > 0
                ? `+${categoryStats.totalXp.toLocaleString()} XP`
                : categoryStats.totalXp < 0
                ? `${categoryStats.totalXp.toLocaleString()} XP`
                : '0 XP'}
            </span>
          </div>
        </div>

        {/* Search & Sort Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 sm:px-6 bg-slate-900/30 border-b border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by ICAO, city, or aircraft..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500 text-xs flex items-center space-x-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="fpm-softest">Softest Landing (Low FPM)</option>
              <option value="fpm-hardest">Firmest Landing (High FPM)</option>
            </select>
          </div>
        </div>

        {/* Landings Log List / Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 scrollbar-thin">
          {filteredLandings.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-3xl bg-slate-900 border border-slate-800">
                {currentConfig.icon}
              </div>
              <h4 className="text-base font-bold text-white uppercase tracking-wide">
                No Landings Found
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No touchdowns matching "${searchQuery}" in ${currentConfig.label}.`
                  : activeCategory === 'Severe' || activeCategory === 'Hard'
                  ? 'No hard touchdowns recorded! You are keeping the fleet safe and passengers comfortable.'
                  : `No landings recorded in this category yet. Fly flights to populate your career touchdown telemetry.`}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 hover:bg-cyan-900/60 transition"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLandings.map((item) => {
                const destCity = getAirportCity(item.destination_icao);
                const destName = getAirportName(item.destination_icao);
                const originName = getAirportName(item.origin_icao);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-slate-700/90 transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:bg-slate-900/90"
                  >
                    {/* Left: Rating & FPM Badge */}
                    <div className="flex items-center space-x-3.5 min-w-[200px]">
                      <div
                        className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center min-w-[95px] ${item.ratingInfo.badgeColor}`}
                      >
                        <span className="text-base font-bold tracking-tight">
                          {item.fpm} FPM
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5">
                          {item.ratingInfo.label}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white">
                            {item.ratingInfo.fullLabel}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 mt-1">
                          {item.ratingInfo.aircraftClassLabel && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 font-bold">
                              {item.ratingInfo.aircraftClassLabel}
                            </span>
                          )}
                          {item.approach_speed_kts && (
                            <span className="text-[10px] text-slate-400">
                              App: <strong className="text-slate-300">{item.approach_speed_kts} kts</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Route & Aircraft */}
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-white">
                          {item.origin_icao}
                        </span>
                        <span className="text-slate-500">➔</span>
                        <span className="text-sm font-bold text-cyan-400">
                          {item.destination_icao}
                        </span>
                        {item.distance_nm && (
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({item.distance_nm} NM)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400 mt-1">
                        <span className="text-slate-300 font-medium truncate max-w-[200px]" title={item.aircraft_name}>
                          {item.aircraft_name}
                        </span>
                        {item.tail_number && (
                          <span className="text-[10px] text-slate-500">
                            • {item.tail_number}
                          </span>
                        )}
                        {destCity && (
                          <span className="text-slate-500 hidden sm:inline">
                            • {destCity}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Date, XP & Action */}
                    <div className="flex items-center justify-between md:justify-end space-x-4 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                      <div className="text-left md:text-right">
                        <div className="text-xs text-slate-300 flex items-center md:justify-end space-x-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{formatDate(item.completed_at)}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Flight time: {formatDuration(item.duration_seconds)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                            item.ratingInfo.bonusXp > 0
                              ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-400'
                              : item.ratingInfo.bonusXp < 0
                              ? 'bg-rose-950/70 border-rose-800/80 text-rose-400'
                              : 'bg-slate-800/60 border-slate-700 text-slate-400'
                          }`}
                        >
                          {item.ratingInfo.bonusXp > 0
                            ? `+${item.ratingInfo.bonusXp} XP`
                            : item.ratingInfo.bonusXp < 0
                            ? `${item.ratingInfo.bonusXp} XP`
                            : '0 XP'}
                        </span>

                        {onSwitchToLogbook && (
                          <button
                            onClick={() => {
                              onClose?.();
                              onSwitchToLogbook();
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-950/40 transition"
                            title="View career logbook"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Showing {filteredLandings.length} of {recordedLandings.length} recorded landings
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onSwitchToLogbook && (
              <button
                onClick={() => {
                  onClose?.();
                  onSwitchToLogbook();
                }}
                className="text-cyan-400 hover:text-cyan-300 transition flex items-center space-x-1 font-bold"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open Full Logbook</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingCategoryModal;

