import React, { useState, useEffect, useMemo } from 'react';
import { X, MapPin, Search, Plane, Navigation, CheckCircle2, Loader2 } from 'lucide-react';
import { fetchAirports } from '../api/client.js';

const POPULAR_HUBS = [
  { icao: 'KLAX', name: 'Los Angeles', country: 'US' },
  { icao: 'KSFO', name: 'San Francisco', country: 'US' },
  { icao: 'KLAS', name: 'Las Vegas', country: 'US' },
  { icao: 'KXNA', name: 'NW Arkansas', country: 'US' },
  { icao: 'KORD', name: 'Chicago OHare', country: 'US' },
  { icao: 'KDEN', name: 'Denver', country: 'US' },
  { icao: 'KDFW', name: 'Dallas/Fort Worth', country: 'US' },
  { icao: 'KATL', name: 'Atlanta', country: 'US' },
  { icao: 'KJFK', name: 'New York JFK', country: 'US' },
  { icao: 'KMIA', name: 'Miami', country: 'US' },
  { icao: 'KSEA', name: 'Seattle', country: 'US' },
  { icao: 'EGLL', name: 'London Heathrow', country: 'GB' },
  { icao: 'LFPG', name: 'Paris CDG', country: 'FR' },
  { icao: 'EDDF', name: 'Frankfurt', country: 'DE' },
  { icao: 'OMDB', name: 'Dubai', country: 'AE' },
  { icao: 'RJTT', name: 'Tokyo Haneda', country: 'JP' }
];

export function ChangeBaseModal({
  isOpen,
  onClose,
  currentIcao = 'KLAX',
  allAirports = [],
  onSelectBaseAirport
}) {
  const [search, setSearch] = useState('');
  const [customIcao, setCustomIcao] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');

  // Live backend search across 6,000+ airports in database
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchAirports(search.trim());
        setSearchResults(results || []);
      } catch (err) {
        console.error('Airport search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const displayedAirports = useMemo(() => {
    if (search.trim()) {
      if (searchResults.length > 0) return searchResults;
      const q = search.trim().toLowerCase();
      return allAirports
        .filter(
          (a) =>
            a.icao.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.city?.toLowerCase().includes(q) ||
            a.country?.toLowerCase().includes(q)
        )
        .slice(0, 40);
    }
    return allAirports.slice(0, 30);
  }, [search, searchResults, allAirports]);

  if (!isOpen) return null;

  const handleSelect = async (icao) => {
    setError('');
    setLoading(true);
    try {
      await onSelectBaseAirport(icao.toUpperCase());
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update base airport');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customIcao.trim()) return;
    handleSelect(customIcao.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl glass-panel border border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono tracking-wide">
                SELECT DEPARTURE AIRPORT
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Current Departure: <strong className="text-cyan-400">{currentIcao}</strong> • Select an airfield to reposition aircraft & dispatch jobs
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

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-950/70 border-b border-rose-800 text-xs font-mono text-rose-300">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Quick Hubs */}
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
              Popular Flight Hubs:
            </span>
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              {POPULAR_HUBS.map((hub) => {
                const isCurrent = hub.icao === currentIcao;
                return (
                  <button
                    key={hub.icao}
                    onClick={() => handleSelect(hub.icao)}
                    disabled={loading || isCurrent}
                    className={`px-2.5 py-1.5 rounded-lg border transition flex items-center space-x-1 ${
                      isCurrent
                        ? 'bg-cyan-950/80 text-cyan-400 border-cyan-700 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{hub.icao}</span>
                    <span className="text-[10px] text-slate-500">({hub.country})</span>
                    {isCurrent && <CheckCircle2 className="w-3 h-3 text-cyan-400 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar & Custom ICAO input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="relative">
              {searching ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin absolute left-3 top-3" />
              ) : (
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              )}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ICAO (e.g. KXNA), city..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <form onSubmit={handleCustomSubmit} className="flex items-center space-x-2">
              <input
                type="text"
                value={customIcao}
                onChange={(e) => setCustomIcao(e.target.value.toUpperCase())}
                placeholder="Direct ICAO code..."
                maxLength={4}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-500 uppercase"
              />
              <button
                type="submit"
                disabled={loading || !customIcao.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold transition"
              >
                Set Base
              </button>
            </form>
          </div>

          {/* Airport List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {displayedAirports.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-500">
                No airports matching "{search}". You can still type the ICAO code into "Direct ICAO code" above.
              </div>
            ) : (
              displayedAirports.map((airport) => {
                const isCurrent = airport.icao === currentIcao;
                return (
                  <div
                    key={airport.icao}
                    onClick={() => !isCurrent && handleSelect(airport.icao)}
                    className={`p-3 rounded-xl border font-mono text-xs flex items-center justify-between transition cursor-pointer ${
                      isCurrent
                        ? 'bg-cyan-950/40 border-cyan-800 cursor-default'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-white text-xs">
                        {airport.icao}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{airport.name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-900 text-[10px] text-cyan-200">
                              CURRENT BASE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {airport.city ? `${airport.city}, ` : ''}{airport.country} • Runway:{' '}
                          {airport.longest_runway_ft?.toLocaleString() || '3,000'} ft
                        </p>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white transition text-xs"
                      >
                        Select
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangeBaseModal;
