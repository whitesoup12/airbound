import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Compass,
  ExternalLink,
  Layers,
  Download,
  Maximize2,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Plane,
  Navigation,
  Globe,
  Loader2
} from 'lucide-react';
import { fetchAirportCharts, getStoredPasscode } from '../api/client.js';
import WeatherBriefingCard from './WeatherBriefingCard.jsx';

export function AirportChartsModal({
  isOpen,
  onClose,
  icao,
  airportName = ''
}) {
  const [activeIcao, setActiveIcao] = useState(icao || '');
  const [icaoInput, setIcaoInput] = useState(icao || '');
  const [loading, setLoading] = useState(false);
  const [chartsData, setChartsData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedChart, setSelectedChart] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [iframeLoading, setIframeLoading] = useState(true);

  // Sync active ICAO whenever incoming prop or modal open state changes
  useEffect(() => {
    if (icao) {
      const code = icao.toUpperCase().trim();
      setActiveIcao(code);
      setIcaoInput(code);
    }
  }, [icao, isOpen]);

  // Fetch charts whenever modal opens or activeIcao changes
  useEffect(() => {
    if (!isOpen || !activeIcao) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSearchQuery('');

    fetchAirportCharts(activeIcao)
      .then((data) => {
        if (!isMounted) return;
        setChartsData(data);
        // Automatically default to the primary Airport Diagram if available, else first approach, else first chart
        const primary =
          data?.primaryDiagram ||
          data?.categories?.diagrams?.[0] ||
          data?.categories?.approaches?.[0] ||
          data?.categories?.departures?.[0] ||
          data?.categories?.arrivals?.[0] ||
          null;
        setSelectedChart(primary);
        setSelectedCategory(primary?.category === 'diagram' ? 'diagrams' : 'all');
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching airport charts:', err);
        setError(err.message || 'Failed to load airport charts');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeIcao]);

  // When selectedChart changes, reset iframe loading indicator
  useEffect(() => {
    if (selectedChart) {
      setIframeLoading(true);
    }
  }, [selectedChart]);

  // Build PDF URL with passcode parameter if configured
  const chartPdfUrl = useMemo(() => {
    if (!selectedChart) return '';
    const base = selectedChart.proxyUrl || selectedChart.url;
    const passcode = getStoredPasscode();
    if (passcode && base.includes('/charts/proxy')) {
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}passcode=${encodeURIComponent(passcode)}`;
    }
    return base;
  }, [selectedChart]);

  // Filter procedures by category and search query
  const filteredProcedures = useMemo(() => {
    if (!chartsData?.categories) return [];
    let list = [];

    if (selectedCategory === 'all') {
      list = [
        ...(chartsData.categories.diagrams || []),
        ...(chartsData.categories.approaches || []),
        ...(chartsData.categories.departures || []),
        ...(chartsData.categories.arrivals || []),
        ...(chartsData.categories.minimums || []),
        ...(chartsData.categories.other || [])
      ];
    } else {
      list = chartsData.categories[selectedCategory] || [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) =>
        (c.chart_name || '').toLowerCase().includes(q) ||
        (c.chart_code || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [chartsData, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const airportTitle = chartsData?.airport?.name || airportName || activeIcao;
  const longestRunway = chartsData?.airport?.longest_runway_ft;
  const isUsAirport = (activeIcao || '').toUpperCase().startsWith('K') || (chartsData?.airport?.country === 'US');

  const handleIcaoSubmit = (e) => {
    e.preventDefault();
    const clean = icaoInput.trim().toUpperCase();
    if (clean && clean !== activeIcao) {
      setActiveIcao(clean);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-6xl h-[92vh] max-h-[900px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="px-5 py-3 bg-slate-950/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-400 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <form onSubmit={handleIcaoSubmit} className="flex items-center space-x-1">
                  <input
                    type="text"
                    maxLength={5}
                    value={icaoInput}
                    onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
                    placeholder="ICAO"
                    className="w-20 px-2 py-0.5 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg text-lg font-mono font-black text-cyan-400 uppercase focus:outline-none transition text-center tracking-wider"
                    title="Type any ICAO code and press Enter to switch airfield"
                  />
                  <button
                    type="submit"
                    disabled={!icaoInput.trim() || icaoInput.trim().toUpperCase() === activeIcao}
                    className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white rounded-lg text-[10px] font-mono font-bold transition"
                  >
                    GO
                  </button>
                </form>
                <span className="text-slate-500 font-mono text-xs hidden sm:inline">/</span>
                <span className="text-sm font-bold text-slate-200 truncate max-w-xs sm:max-w-md">
                  {airportTitle}
                </span>
              </div>
              <div className="flex items-center space-x-2.5 text-[11px] font-mono text-slate-400 mt-0.5">
                {chartsData?.airport?.city && (
                  <span>{chartsData.airport.city}, {chartsData.airport.country || 'USA'}</span>
                )}
                {longestRunway > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">
                      Max Runway: {longestRunway.toLocaleString()} FT
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="text-cyan-300/90 font-semibold">
                  {chartsData?.cycle ? `FAA AIRAC ${chartsData.cycle}` : 'Aeronautical Charts'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick External Links & Close Button */}
          <div className="flex items-center space-x-2">
            {chartsData?.externalLinks?.chartfox && (
              <a
                href={chartsData.externalLinks.chartfox}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-mono font-semibold border border-slate-700 flex items-center space-x-1.5 transition"
                title="Open in ChartFox (Worldwide Free AIPs)"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">ChartFox</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            {chartsData?.externalLinks?.airnav && (
              <a
                href={chartsData.externalLinks.airnav}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 text-xs font-mono font-semibold border border-slate-700 flex items-center space-x-1.5 transition"
                title="Open in AirNav"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="hidden sm:inline">AirNav</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            {chartsData?.externalLinks?.skyvector && (
              <a
                href={chartsData.externalLinks.skyvector}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 text-xs font-mono font-semibold border border-slate-700 flex items-center space-x-1.5 transition"
                title="Open in SkyVector"
              >
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">SkyVector</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-400 border border-slate-700 hover:border-rose-500/50 transition ml-2"
              title="Close Charts Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Weather Observation & Active Runway Strip */}
        <div className="px-5 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
          <WeatherBriefingCard icao={activeIcao} compact={true} />
        </div>

        {/* Modal Body: Left Procedure List & Right PDF Viewer */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-950">
          
          {/* Left Column: Procedures Navigation */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-950/60 flex-shrink-0">
            
            {/* Search Filter */}
            <div className="p-3 border-b border-slate-800/80">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter (e.g. 31, ILS, RNAV, APD)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5 mt-2.5 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2 py-1 rounded transition ${
                    selectedCategory === 'all'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  All ({chartsData?.totalCharts || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('diagrams')}
                  className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
                    selectedCategory === 'diagrams'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-emerald-300 border border-slate-800'
                  }`}
                >
                  <span>Diagrams</span>
                  {chartsData?.categories?.diagrams?.length > 0 && (
                    <span className="text-[10px] opacity-80">({chartsData.categories.diagrams.length})</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('approaches')}
                  className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
                    selectedCategory === 'approaches'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-cyan-300 border border-slate-800'
                  }`}
                >
                  <span>Approaches</span>
                  {chartsData?.categories?.approaches?.length > 0 && (
                    <span className="text-[10px] opacity-80">({chartsData.categories.approaches.length})</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('departures')}
                  className={`px-2 py-1 rounded transition ${
                    selectedCategory === 'departures'
                      ? 'bg-purple-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-purple-300 border border-slate-800'
                  }`}
                >
                  SIDs ({chartsData?.categories?.departures?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('arrivals')}
                  className={`px-2 py-1 rounded transition ${
                    selectedCategory === 'arrivals'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-amber-300 border border-slate-800'
                  }`}
                >
                  STARs ({chartsData?.categories?.arrivals?.length || 0})
                </button>
              </div>
            </div>

            {/* Scrollable Procedure Items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 font-mono text-xs space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <span>Loading procedures from FAA d-TPP...</span>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-mono space-y-2">
                  <div className="flex items-center space-x-2 text-rose-400 font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Error Loading Charts</span>
                  </div>
                  <p>{error}</p>
                </div>
              ) : filteredProcedures.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 font-mono text-xs text-center p-4">
                  {chartsData?.hasFaaCharts === false ? (
                    <div className="space-y-3">
                      <Globe className="w-8 h-8 text-cyan-400 mx-auto opacity-60" />
                      <p className="text-slate-300 font-bold">International / Non-FAA Airport</p>
                      <p className="text-[11px] text-slate-400 max-w-xs">
                        This airport is outside FAA d-TPP coverage. You can access free official charts directly on ChartFox.
                      </p>
                      <a
                        href={chartsData?.externalLinks?.chartfox}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition text-xs shadow"
                      >
                        <span>Open on ChartFox</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <span>No procedures found matching filter.</span>
                  )}
                </div>
              ) : (
                filteredProcedures.map((item, idx) => {
                  const isSelected = selectedChart?.pdf_name === item.pdf_name;
                  const isDiagram = item.category === 'diagram';
                  const isIls = (item.chart_name || '').startsWith('ILS');
                  const isRnav = (item.chart_name || '').startsWith('RNAV');

                  const tagColor = isDiagram
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isIls
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : isRnav
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700';

                  return (
                    <button
                      key={`${item.pdf_name}-${idx}`}
                      type="button"
                      onClick={() => setSelectedChart(item)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between text-xs font-mono group ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                          : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold truncate group-hover:text-cyan-300 transition-colors">
                          {item.chart_name}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {item.pdf_name}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${tagColor}`}>
                        {item.chart_code || item.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Embedded PDF Viewer */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
            {selectedChart ? (
              <>
                {/* Chart Header Bar */}
                <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-cyan-400 font-bold">CHART:</span>
                    <span className="text-white font-bold truncate">
                      {selectedChart.chart_name}
                    </span>
                    <span className="text-slate-500 text-[11px] hidden sm:inline">
                      ({selectedChart.pdf_name})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {/* Open direct PDF link in new tab */}
                    <a
                      href={chartPdfUrl || selectedChart.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-slate-700 flex items-center space-x-1.5 transition"
                      title="Open full PDF in browser tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Open in Tab</span>
                    </a>

                    {/* Download PDF button */}
                    <a
                      href={chartPdfUrl || selectedChart.url}
                      download={selectedChart.pdf_name}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* PDF Viewer Container */}
                <div className="flex-1 w-full h-full relative bg-slate-950">
                  {iframeLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-10 text-slate-400 font-mono text-xs space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      <span>Rendering Chart PDF...</span>
                    </div>
                  )}
                  <iframe
                    src={chartPdfUrl}
                    title={selectedChart.chart_name}
                    onLoad={() => setIframeLoading(false)}
                    className="w-full h-full border-none bg-slate-950"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs p-6 text-center space-y-3">
                <FileText className="w-10 h-10 text-slate-600 opacity-60" />
                <p className="text-slate-400 font-bold">Select a procedure from the list on the left to view</p>
                <p className="text-[11px] text-slate-500 max-w-md">
                  Choose Airport Diagrams (APD), Instrument Approaches (ILS / RNAV), Standard Departures (SID), or Arrivals (STAR).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info Bar */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Free Public Domain FAA Aeronav & AIP Charts</span>
            <span>•</span>
            <span>AIRAC 28-day cycle updates automatically</span>
          </div>
          <div>
            <span>Airbound Tactical Avionics</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AirportChartsModal;
