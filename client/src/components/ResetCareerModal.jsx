import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  RotateCcw,
  MapPin,
  Search,
  CheckCircle2,
  DollarSign,
  Plane,
  Loader2,
  Sparkles
} from 'lucide-react';
import { fetchAirports } from '../api/client.js';

const POPULAR_HUBS = [
  { icao: 'KXNA', name: 'NW Arkansas National', country: 'US', city: 'Fayetteville' },
  { icao: 'KLAX', name: 'Los Angeles Intl', country: 'US', city: 'Los Angeles' },
  { icao: 'KDFW', name: 'Dallas/Fort Worth Intl', country: 'US', city: 'Dallas' },
  { icao: 'KORD', name: 'O\'Hare Intl', country: 'US', city: 'Chicago' },
  { icao: 'KDEN', name: 'Denver Intl', country: 'US', city: 'Denver' },
  { icao: 'KSFO', name: 'San Francisco Intl', country: 'US', city: 'San Francisco' },
  { icao: 'KATL', name: 'Hartsfield-Jackson Atlanta', country: 'US', city: 'Atlanta' },
  { icao: 'KJFK', name: 'John F. Kennedy Intl', country: 'US', city: 'New York' },
  { icao: 'KMIA', name: 'Miami Intl', country: 'US', city: 'Miami' },
  { icao: 'KSEA', name: 'Seattle-Tacoma Intl', country: 'US', city: 'Seattle' },
  { icao: 'EGLL', name: 'London Heathrow', country: 'GB', city: 'London' },
  { icao: 'LFPG', name: 'Paris Charles de Gaulle', country: 'FR', city: 'Paris' }
];

export function ResetCareerModal({
  isOpen,
  onClose,
  currentIcao = 'KXNA',
  allAirports = [],
  onConfirmReset
}) {
  const [selectedIcao, setSelectedIcao] = useState(currentIcao || 'KXNA');
  const [selectedAirportObj, setSelectedAirportObj] = useState(null);
  const [search, setSearch] = useState('');
  const [customIcao, setCustomIcao] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Synchronize initial default base airport
  useEffect(() => {
    if (isOpen) {
      const initial = currentIcao || 'KXNA';
      setSelectedIcao(initial);
      setError('');
      setSearch('');
      setCustomIcao('');
      const matched =
        allAirports.find((a) => a.icao === initial) ||
        POPULAR_HUBS.find((h) => h.icao === initial);
      if (matched) setSelectedAirportObj(matched);
    }
  }, [isOpen, currentIcao, allAirports]);

  // Live search across backend airports
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

  // Merge results for display
  const displayedAirports = useMemo(() => {
    if (search.trim()) {
      if (searchResults.length > 0) return searchResults;
      const q = search.trim().toLowerCase();
      return allAirports
        .filter(
          (a) =>
            a.icao.toLowerCase().includes(q) ||
            a.name?.toLowerCase().includes(q) ||
            a.city?.toLowerCase().includes(q)
        )
        .slice(0, 30);
    }
    return allAirports.slice(0, 20);
  }, [search, searchResults, allAirports]);

  if (!isOpen) return null;

  const handlePickAirport = (airport) => {
    const icao = (airport.icao || airport).toUpperCase();
    setSelectedIcao(icao);
    if (typeof airport === 'object') {
      setSelectedAirportObj(airport);
    } else {
      const matched =
        allAirports.find((a) => a.icao === icao) ||
        POPULAR_HUBS.find((h) => h.icao === icao);
      setSelectedAirportObj(matched || { icao, name: icao });
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customIcao.trim()) return;
    const code = customIcao.trim().toUpperCase();
    handlePickAirport(code);
    setCustomIcao('');
  };

  const handleExecuteReset = async () => {
    if (!selectedIcao) {
      setError('Please select a home base airport to begin your career.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onConfirmReset(selectedIcao);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to reset career');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl glass-panel border border-rose-800/60 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-rose-950/80 bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-700 flex items-center justify-center text-rose-400 shadow-inner">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono tracking-wide flex items-center space-x-2">
                <span>RESET PILOT CAREER</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-rose-900/60 text-rose-300 border border-rose-700 font-sans font-medium">
                  Irreversible
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Initialize career profile, select home base, and claim starting grant
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

        {/* Warning & Incentive Callout */}
        <div className="px-5 py-3.5 bg-rose-950/30 border-b border-rose-900/40 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-slate-300 space-y-1">
            <div>
              Flight logs and flight hours are <strong>permanently preserved</strong>. Resetting will set your liquid funds to $15,000, cancel any active job, reset your fleet to an owned starter Cessna 172 Skyhawk, and reposition you at your chosen home base.
            </div>
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold pt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Starting Liquid Funds: <strong>$15,000</strong> cash</span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-950 border-b border-rose-800 text-xs font-mono text-rose-200">
            {error}
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Chosen Home Base Summary Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-800/60 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                  Chosen Home Base Airport
                </span>
                <span className="text-base font-bold font-mono text-white flex items-center space-x-2">
                  <span className="text-cyan-400">{selectedIcao}</span>
                  {selectedAirportObj?.name && (
                    <span className="text-xs font-normal text-slate-300">
                      • {selectedAirportObj.name} {selectedAirportObj.country ? `(${selectedAirportObj.country})` : ''}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-xs font-mono">
              Ready to Base
            </span>
          </div>

          {/* Quick Hubs */}
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
              Select Starting Hub or Custom Airfield:
            </span>
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              {POPULAR_HUBS.map((hub) => {
                const isSelected = hub.icao === selectedIcao;
                return (
                  <button
                    key={hub.icao}
                    type="button"
                    onClick={() => handlePickAirport(hub)}
                    className={`px-2.5 py-1.5 rounded-lg border transition flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-cyan-950 text-cyan-400 border-cyan-500 font-bold shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{hub.icao}</span>
                    <span className="text-[10px] text-slate-500">({hub.city || hub.country})</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar & Custom ICAO input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                placeholder="Search 6,000+ airports..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <form onSubmit={handleCustomSubmit} className="flex items-center space-x-2">
              <input
                type="text"
                value={customIcao}
                onChange={(e) => setCustomIcao(e.target.value.toUpperCase())}
                placeholder="Enter ICAO (e.g. KXNA)"
                maxLength={4}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-500 uppercase"
              />
              <button
                type="submit"
                disabled={!customIcao.trim()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-mono font-bold transition border border-slate-700"
              >
                Select
              </button>
            </form>
          </div>

          {/* Search / Airport List results */}
          {search.trim() && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 border border-slate-800/80 rounded-xl p-2 bg-slate-900/40">
              {displayedAirports.length === 0 ? (
                <div className="p-4 text-center text-xs font-mono text-slate-500">
                  {searching ? 'Searching airports...' : 'No matching airports found.'}
                </div>
              ) : (
                displayedAirports.map((airport) => {
                  const isSelected = airport.icao === selectedIcao;
                  return (
                    <button
                      key={airport.icao}
                      type="button"
                      onClick={() => handlePickAirport(airport)}
                      className={`w-full p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-600 text-white'
                          : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono font-bold text-cyan-400 text-xs">
                          {airport.icao}
                        </span>
                        <div className="text-xs">
                          <span className="font-medium text-slate-200">{airport.name}</span>
                          <span className="text-slate-500 ml-1">
                            • {airport.city || airport.country}
                          </span>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteReset}
            disabled={loading || !selectedIcao}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-mono text-xs font-bold shadow-lg shadow-rose-950 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Resetting Career...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Reset Career at {selectedIcao} ($15,000)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetCareerModal;

