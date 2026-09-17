import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Award,
  Compass,
  Clock,
  Globe,
  Calendar,
  Package,
  Users,
  DollarSign,
  Plane,
  Fuel,
  CheckCircle2,
  FileText,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import VisitedAirportsMap from '../VisitedAirportsMap.jsx';
import { formatLandingRating } from '../../utils/xpUtils.js';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
function getFullCountryName(code) {
  if (!code || code === 'OTHER' || code === 'UNKNOWN') return 'Other / Uncategorized';
  try {
    return regionNames.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

export function CareerLogbookView({
  pilot,
  currentAirport,
  visitedAirportsDetails = [],
  allAirports = [],
  onOpenChangeBase,
  onSwitchToProgression
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'dispatch' | 'msfs'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('completed_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [hoveredAirport, setHoveredAirport] = useState(null);
  const [expandedCountries, setExpandedCountries] = useState(() => new Set());

  const flightLog = pilot?.flight_log || [];
  const visitedAirports = pilot?.visited_airports || [];
  const visitedCountries = pilot?.visited_countries || [];

  const totalNm = useMemo(
    () => flightLog.reduce((acc, f) => acc + (f.distance_nm || 0), 0),
    [flightLog]
  );
  const totalDurationSec = useMemo(
    () => flightLog.reduce((acc, f) => acc + (f.duration_seconds || f.airborne_seconds || 0), 0),
    [flightLog]
  );

  // Lookup map for airport details
  const airportInfoMap = useMemo(() => {
    const map = new Map();
    for (const a of allAirports) {
      if (a.icao) map.set(a.icao.toUpperCase(), a);
    }
    for (const a of visitedAirportsDetails) {
      if (a.icao) map.set(a.icao.toUpperCase(), a);
    }
    return map;
  }, [allAirports, visitedAirportsDetails]);

  // Flight counts per airport
  const airportFlightCounts = useMemo(() => {
    const counts = new Map();
    for (const f of flightLog) {
      if (f.origin_icao) {
        const orig = f.origin_icao.toUpperCase();
        counts.set(orig, (counts.get(orig) || 0) + 1);
      }
      if (f.destination_icao && f.destination_icao !== f.origin_icao) {
        const dest = f.destination_icao.toUpperCase();
        counts.set(dest, (counts.get(dest) || 0) + 1);
      }
    }
    return counts;
  }, [flightLog]);

  // Group visited airports by country
  const airportsByCountry = useMemo(() => {
    const groups = new Map();

    for (const icao of visitedAirports) {
      const code = icao.toUpperCase();
      const info = airportInfoMap.get(code);
      const country = (info?.country || 'OTHER').toUpperCase();

      if (!groups.has(country)) {
        groups.set(country, []);
      }
      groups.get(country).push({
        icao: code,
        name: info?.name || code,
        city: info?.city || '',
        country,
        longest_runway_ft: info?.longest_runway_ft || 0,
        coordinates: info?.location?.coordinates || null,
        flightCount: airportFlightCounts.get(code) || 1
      });
    }

    // Sort airports inside each country alphabetically
    for (const [country, list] of groups.entries()) {
      list.sort((a, b) => a.icao.localeCompare(b.icao));
    }

    // Return sorted array of country groups (most visited airports first, secondary sort alphabetically)
    return Array.from(groups.entries()).sort(([c1, list1], [c2, list2]) => {
      if (list2.length !== list1.length) {
        return list2.length - list1.length;
      }
      const name1 = getFullCountryName(c1);
      const name2 = getFullCountryName(c2);
      return name1.localeCompare(name2);
    });
  }, [visitedAirports, airportInfoMap, airportFlightCounts]);

  const toggleCountry = (countryCode) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryCode)) {
        next.delete(countryCode);
      } else {
        next.add(countryCode);
      }
      return next;
    });
  };

  const toggleAllCountries = () => {
    if (expandedCountries.size === airportsByCountry.length) {
      setExpandedCountries(new Set());
    } else {
      setExpandedCountries(new Set(airportsByCountry.map(([code]) => code)));
    }
  };

  // Assign canonical chronological flight number to each flight entry (#1 for earliest flight)
  const augmentedFlightLog = useMemo(() => {
    // Sort chronologically ascending
    const chronological = [...flightLog]
      .map((f, originalIndex) => ({
        ...f,
        _originalIndex: originalIndex,
        _time: f.completed_at ? new Date(f.completed_at).getTime() : 0
      }))
      .sort((a, b) => a._time - b._time);

    // Map each flight by its original index to its canonical flight number (1-based)
    const numberMap = new Map();
    chronological.forEach((item, idx) => {
      numberMap.set(item._originalIndex, idx + 1);
    });

    return flightLog.map((f, originalIndex) => ({
      ...f,
      flightNumber: numberMap.get(originalIndex) || (originalIndex + 1)
    }));
  }, [flightLog]);

  const dispatchedFlights = useMemo(
    () => augmentedFlightLog.filter((f) => f.source !== 'msfs_import' && !f.is_external),
    [augmentedFlightLog]
  );
  const importedFlights = useMemo(
    () => augmentedFlightLog.filter((f) => f.source === 'msfs_import' || f.is_external),
    [augmentedFlightLog]
  );

  // Filter and sort the flights table
  const filteredAndSortedFlights = useMemo(() => {
    let list = [...augmentedFlightLog];

    // Filter tab
    if (filter === 'dispatch') {
      list = list.filter((f) => f.source !== 'msfs_import' && !f.is_external);
    } else if (filter === 'msfs') {
      list = list.filter((f) => f.source === 'msfs_import' || f.is_external);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qNum = q.replace(/^#/, '');
      list = list.filter((f) => {
        return (
          (qNum && f.flightNumber?.toString() === qNum) ||
          f.origin_icao?.toLowerCase().includes(q) ||
          f.destination_icao?.toLowerCase().includes(q) ||
          f.aircraft_name?.toLowerCase().includes(q) ||
          (f.completed_at && new Date(f.completed_at).toLocaleDateString().includes(q)) ||
          airportInfoMap.get(f.origin_icao)?.name?.toLowerCase().includes(q) ||
          airportInfoMap.get(f.destination_icao)?.name?.toLowerCase().includes(q)
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'flightNumber':
          valA = a.flightNumber || 0;
          valB = b.flightNumber || 0;
          break;
        case 'completed_at':
          valA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          valB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          break;
        case 'distance_nm':
          valA = a.distance_nm || 0;
          valB = b.distance_nm || 0;
          break;
        case 'duration_seconds':
          valA = a.duration_seconds || 0;
          valB = b.duration_seconds || 0;
          break;
        case 'touchdown_fpm':
          valA = a.touchdown_fpm != null ? Math.abs(a.touchdown_fpm) : 9999;
          valB = b.touchdown_fpm != null ? Math.abs(b.touchdown_fpm) : 9999;
          break;
        case 'xp_earned':
          valA = a.xp_earned || a.distance_nm || 0;
          valB = b.xp_earned || b.distance_nm || 0;
          break;
        case 'payout':
          valA = a.net_payout || a.payout || 0;
          valB = b.net_payout || b.payout || 0;
          break;
        case 'origin_icao':
          valA = a.origin_icao || '';
          valB = b.origin_icao || '';
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'destination_icao':
          valA = a.destination_icao || '';
          valB = b.destination_icao || '';
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'aircraft_name':
          valA = a.aircraft_name || '';
          valB = b.aircraft_name || '';
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        default:
          valA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          valB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [augmentedFlightLog, filter, searchQuery, sortField, sortAsc, airportInfoMap]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default to descending for new field
    }
  };

  const formatDuration = (sec) => {
    if (!sec || sec < 60) return `${sec || 0}s`;
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m ${sec % 60}s`;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Flight Log Vital Statistics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-inner flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">FLIGHTS LOGGED</span>
            <span className="text-2xl font-bold text-white mt-1 block">{flightLog.length}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Recorded MSFS Flights</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-300">
            <Plane className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-inner flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">TOTAL AIR MILES</span>
            <span className="text-2xl font-bold text-cyan-400 mt-1 block">
              {Math.round(totalNm).toLocaleString()} NM
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Airborne distance tracked</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
            <Compass className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 shadow-inner flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] block uppercase tracking-wider">TOTAL FLIGHT TIME</span>
            <span className="text-2xl font-bold text-amber-400 mt-1 block">
              {formatDuration(totalDurationSec)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Airborne time logged</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Cleaned Exploration Hub - Grouped by Country */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 space-y-4 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="text-slate-200 font-bold text-sm tracking-wide">
              EXPLORATION HUB: VISITED AIRPORTS BY COUNTRY
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={toggleAllCountries}
              className="text-[11px] text-slate-400 hover:text-cyan-300 transition underline underline-offset-2 decoration-slate-700 cursor-pointer"
            >
              {expandedCountries.size === airportsByCountry.length ? 'Collapse All' : 'Expand All'}
            </button>
            <span className="text-xs text-purple-300 font-semibold bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-800/60">
              {visitedAirports.length} Airports across {airportsByCountry.length} {airportsByCountry.length === 1 ? 'Country' : 'Countries'}
            </span>
          </div>
        </div>

        {/* Quick Airport Inspector Banner on Hover (Fixed Height to Prevent Layout Shift) */}
        <div className="min-h-[54px] p-3 rounded-xl border flex items-center justify-between text-xs bg-slate-950/70 border-slate-800/90">
          {hoveredAirport ? (
            <div className="flex flex-wrap items-center justify-between w-full gap-3 animate-fadeIn">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-bold text-cyan-400 flex items-center space-x-1">
                  {hoveredAirport.icao === (pilot?.current_icao || 'KXNA').toUpperCase() && <span>★</span>}
                  <span>{hoveredAirport.icao}</span>
                </span>
                <span className="font-semibold text-white truncate max-w-[280px] sm:max-w-none">
                  {hoveredAirport.name}
                </span>
                {hoveredAirport.city && (
                  <span className="text-slate-400 hidden sm:inline">({hoveredAirport.city})</span>
                )}
              </div>
              <div className="flex items-center space-x-4 text-slate-300 text-[11px]">
                <span>
                  Runway: <strong className="text-slate-100">{hoveredAirport.longest_runway_ft > 0 ? `${hoveredAirport.longest_runway_ft.toLocaleString()} ft` : 'N/A'}</strong>
                </span>
                <span>
                  Flown: <strong className="text-purple-300">{hoveredAirport.flightCount}x</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-700/60 font-bold">
                  {getFullCountryName(hoveredAirport.country)} ({hoveredAirport.country})
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full text-[11px] text-slate-400 flex items-center justify-between">
              <span>Hover any airport badge below to inspect airfield details and flight history.</span>
              <span className="text-slate-500">Click any country row to expand/collapse</span>
            </div>
          )}
        </div>

        {/* Countries & Grouped Airports (Accordion Style in Scrollable Container) */}
        <div className="max-h-80 sm:max-h-96 overflow-y-auto pr-2 space-y-2">
          {airportsByCountry.map(([countryCode, airports]) => {
            const countryFullName = getFullCountryName(countryCode);
            const isExpanded = expandedCountries.has(countryCode);

            return (
              <div
                key={countryCode}
                className="rounded-xl bg-slate-950/70 border border-slate-800/90 overflow-hidden transition"
              >
                {/* Accordion Country Row Header */}
                <button
                  type="button"
                  onClick={() => toggleCountry(countryCode)}
                  className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-900/80 transition select-none group cursor-pointer"
                  title={`Click to ${isExpanded ? 'collapse' : 'expand'} ${countryFullName} (${countryCode})`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-500 group-hover:text-purple-400 transition">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-purple-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/60 font-bold text-xs">
                      {countryCode}
                    </span>
                    <span className="text-white font-bold text-sm group-hover:text-purple-300 transition">
                      {countryFullName}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950/70 text-purple-300 border border-purple-800/60">
                      {airports.length} {airports.length === 1 ? 'Airfield' : 'Airfields'}
                    </span>
                  </div>
                </button>

                {/* Accordion Drawer: Airport Badges */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-900/90 bg-slate-950/40">
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {airports.map((airport) => {
                        const isBase = airport.icao === (pilot?.current_icao || 'KXNA').toUpperCase();
                        const isHovered = hoveredAirport?.icao === airport.icao;

                        return (
                          <div
                            key={airport.icao}
                            onMouseEnter={() => setHoveredAirport(airport)}
                            onMouseLeave={() => setHoveredAirport(null)}
                            className="relative"
                          >
                            <span
                              title={`${airport.icao}: ${airport.name}${airport.city ? ` (${airport.city})` : ''} — Runway: ${airport.longest_runway_ft > 0 ? `${airport.longest_runway_ft.toLocaleString()} ft` : 'N/A'} — Flown: ${airport.flightCount}x`}
                              className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold cursor-pointer transition-all flex items-center space-x-1 ${
                                isBase
                                  ? isHovered
                                    ? 'bg-cyan-900 text-cyan-200 border border-cyan-400 shadow-md ring-1 ring-cyan-400'
                                    : 'bg-cyan-950 text-cyan-300 border border-cyan-500 shadow-sm'
                                  : isHovered
                                  ? 'bg-purple-800 text-white border border-purple-400 shadow-md ring-1 ring-purple-400'
                                  : 'bg-purple-950/60 hover:bg-purple-900/70 text-purple-300 border border-purple-800/60 hover:border-purple-600'
                              }`}
                            >
                              {isBase && <span className="text-cyan-400">★</span>}
                              <span>{airport.icao}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Logbook Table in Scrollable Container */}
      <div className="space-y-3">
        {/* Table Controls & Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-1">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 font-bold">
              OFFICIAL MSFS 2024 FLIGHT LOGBOOK
            </h3>
            <span className="text-xs font-mono text-slate-400">
              ({filteredAndSortedFlights.length} {filteredAndSortedFlights.length === 1 ? 'flight' : 'flights'})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ICAO, airport, aircraft..."
                className="w-full pl-8 pr-8 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 font-mono text-xs bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filter === 'all'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({flightLog.length})
              </button>
              <button
                onClick={() => setFilter('dispatch')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filter === 'dispatch'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dispatched ({dispatchedFlights.length})
              </button>
              <button
                onClick={() => setFilter('msfs')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filter === 'msfs'
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MSFS ({importedFlights.length})
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div className="glass-panel rounded-2xl border border-slate-800/90 bg-slate-950 overflow-hidden shadow-2xl">
          <div className="max-h-[580px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider shadow-md">
                <tr>
                  <th
                    onClick={() => handleSort('flightNumber')}
                    className="p-3 w-16 text-center cursor-pointer hover:text-cyan-400 transition select-none"
                    title="Sort by Flight Number"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>#</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('completed_at')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date & Time</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th className="p-3">Source / Type</th>
                  <th
                    onClick={() => handleSort('origin_icao')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Origin</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('destination_icao')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Destination</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('distance_nm')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none text-right"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Distance</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('duration_seconds')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none text-right"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Duration</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('touchdown_fpm')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none text-right"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Touchdown</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('xp_earned')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none text-right"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>XP</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('aircraft_name')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Aircraft</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('payout')}
                    className="p-3 cursor-pointer hover:text-cyan-400 transition select-none text-right pr-4"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Contract Profit</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-800/60">
                {filteredAndSortedFlights.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-12 text-center text-slate-500 font-mono">
                      No matching flights found. Try adjusting your search query or filter.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedFlights.map((record, index) => {
                    const isMsfsImport = record.source === 'msfs_import' || record.is_external;
                    const isExpanded = expandedRowId === (record._id || index);
                    const origInfo = airportInfoMap.get(record.origin_icao);
                    const destInfo = airportInfoMap.get(record.destination_icao);

                    return (
                      <React.Fragment key={record._id || index}>
                        <tr
                          onClick={() => setExpandedRowId(isExpanded ? null : (record._id || index))}
                          className={`hover:bg-slate-900/80 transition cursor-pointer ${
                            isExpanded ? 'bg-slate-900/90' : index % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-950'
                          }`}
                        >
                          {/* Flight Number */}
                          <td className="p-3 text-center text-slate-400 font-bold text-[11px]">
                            {record.flightNumber}
                          </td>

                          {/* Date & Time */}
                          <td className="p-3 whitespace-nowrap">
                            <span className="text-white block font-medium">
                              {record.completed_at
                                ? new Date(record.completed_at).toLocaleDateString()
                                : 'Recent'}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {record.completed_at
                                ? new Date(record.completed_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : ''}
                            </span>
                          </td>

                          {/* Source / Type Badge */}
                          <td className="p-3 whitespace-nowrap">
                            {isMsfsImport ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-950/90 border border-purple-700/70 text-purple-300 text-[10px] font-mono flex items-center space-x-1 w-fit">
                                <Globe className="w-3 h-3 text-purple-400" />
                                <span>MSFS Free Flight</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-700/70 text-cyan-300 text-[10px] font-mono flex items-center space-x-1 w-fit">
                                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                                <span>Dispatch Job</span>
                              </span>
                            )}
                          </td>

                          {/* Origin Airport */}
                          <td className="p-3">
                            <span className="font-bold text-white text-xs">{record.origin_icao}</span>
                            {origInfo?.city && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
                                {origInfo.city}
                              </span>
                            )}
                          </td>

                          {/* Destination Airport */}
                          <td className="p-3">
                            <span className="font-bold text-white text-xs">{record.destination_icao}</span>
                            {destInfo?.city && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
                                {destInfo.city}
                              </span>
                            )}
                          </td>

                          {/* Distance */}
                          <td className="p-3 text-right text-slate-200 font-semibold whitespace-nowrap">
                            {record.distance_nm} NM
                          </td>

                          {/* Duration */}
                          <td className="p-3 text-right text-amber-300 font-medium whitespace-nowrap">
                            {formatDuration(record.duration_seconds)}
                          </td>

                          {/* Touchdown Vertical Speed & Rating */}
                          <td className="p-3 text-right whitespace-nowrap">
                            {record.touchdown_fpm !== undefined && record.touchdown_fpm !== null && Math.abs(record.touchdown_fpm) > 0 ? (() => {
                              const rating = formatLandingRating(record.touchdown_fpm, record.landing_rating, {
                                category: record.category,
                                aircraftName: record.aircraft_name,
                                approachKts: record.approach_speed_kts,
                                landingClass: record.landing_class
                              });
                              return (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${rating.badgeColor} inline-flex items-center space-x-1`}
                                  title={`${rating.fullLabel} (${Math.round(record.touchdown_fpm)} FPM) [${rating.aircraftClassLabel}]`}
                                >
                                  <span>{rating.icon}</span>
                                  <span>{Math.round(record.touchdown_fpm)} FPM</span>
                                </span>
                              );
                            })() : (
                              <span className="text-slate-600 font-normal">—</span>
                            )}
                          </td>

                          {/* XP Earned */}
                          <td className="p-3 text-right whitespace-nowrap text-purple-300 font-bold">
                            +{record.xp_earned || record.distance_nm || 0} XP
                          </td>

                          {/* Aircraft */}
                          <td className="p-3 text-slate-300 whitespace-nowrap max-w-[180px] truncate">
                            {record.aircraft_name || 'MSFS Aircraft'}
                          </td>

                          {/* Payout */}
                          <td className="p-3 text-right pr-4 whitespace-nowrap">
                            {isMsfsImport ? (
                              <span className="text-slate-500 font-normal">-</span>
                            ) : (
                              <span className="text-emerald-400 font-bold">
                                +${(record.net_payout || record.payout)?.toLocaleString()}
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Expandable Flight Ledger Row */}
                        {isExpanded && (
                          <tr className="bg-slate-900/90 border-b border-slate-800">
                            <td colSpan={11} className="p-4">
                              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                  <div className="flex items-center space-x-2">
                                    <Plane className="w-4 h-4 text-cyan-400" />
                                    <span className="font-bold text-white text-sm">
                                      {record.origin_icao} ➔ {record.destination_icao}
                                    </span>
                                    <span className="text-xs text-slate-400">({record.distance_nm} NM)</span>
                                  </div>

                                  <span className="text-xs text-slate-400">
                                    Aircraft: <strong className="text-cyan-300">{record.aircraft_name}</strong>
                                  </span>
                                </div>

                                {isMsfsImport ? (
                                  <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span>Source: MSFS 2024 Logbook {record.external_flight_number ? `(#${record.external_flight_number})` : ''}</span>
                                    <span className="text-slate-500">Free Flight • No commercial operating fees</span>
                                  </div>
                                ) : record.gross_payout ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                      <span className="text-slate-500 block text-[10px]">GROSS PAYOUT</span>
                                      <span className="text-white font-bold text-sm">${record.gross_payout.toLocaleString()}</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                      <span className="text-slate-500 block text-[10px]">FUEL EXPENSE</span>
                                      <span className="text-amber-400 font-bold text-sm">-${(record.fuel_cost || 0).toFixed(2)}</span>
                                      <span className="text-[10px] text-slate-500 block">({record.fuel_gallons || 0} gal)</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                      <span className="text-slate-500 block text-[10px]">LANDING FEES</span>
                                      <span className="text-rose-400 font-bold text-sm">-${record.landing_fee || 0}</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800">
                                      <span className="text-slate-400 block text-[10px]">NET PROFIT</span>
                                      <span className="text-emerald-400 font-bold text-sm">+${(record.net_payout || record.payout).toLocaleString()}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400">
                                    Contract payout: ${(record.payout || 0).toLocaleString()}
                                  </div>
                                )}

                                {/* Flight Performance & Career XP Strip */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
                                  <div className="flex flex-wrap items-center gap-3">
                                    {record.touchdown_fpm !== null && record.touchdown_fpm !== undefined && Math.abs(record.touchdown_fpm) > 0 ? (() => {
                                      const rating = formatLandingRating(record.touchdown_fpm, record.landing_rating, {
                                        category: record.category,
                                        aircraftName: record.aircraft_name,
                                        approachKts: record.approach_speed_kts,
                                        landingClass: record.landing_class
                                      });
                                      return (
                                        <span className="flex items-center space-x-1.5 text-slate-300">
                                          <span className="text-slate-500">Landing Touchdown:</span>
                                          <span className={`px-2 py-0.5 rounded border ${rating.badgeColor} font-bold inline-flex items-center space-x-1`}>
                                            <span>{rating.icon}</span>
                                            <span>{Math.round(record.touchdown_fpm)} FPM ({rating.fullLabel})</span>
                                            <span className="text-[10px] text-slate-400 font-normal">[{rating.aircraftClassLabel}]</span>
                                          </span>
                                        </span>
                                      );
                                    })() : null}
                                    <span className="flex items-center space-x-1 text-purple-300">
                                      <Award className="w-3.5 h-3.5 text-purple-400" />
                                      <span>Career XP Earned: <strong className="text-purple-300">+{record.xp_earned || record.distance_nm || 0} XP</strong></span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CareerLogbookView;
