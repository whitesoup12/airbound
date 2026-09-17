import React, { useState, useEffect } from 'react';
import {
  Plane,
  Warehouse,
  ShoppingBag,
  DollarSign,
  Gauge,
  Compass,
  Package,
  Users,
  Fuel,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Undo2
} from 'lucide-react';
import {
  fetchAircraftCatalog,
  fetchHangar,
  buyAircraft,
  rentAircraft,
  selectActiveAircraft,
  sellAircraft,
  returnAircraft
} from '../../api/client.js';

export function FleetView({ pilot, onAircraftChanged }) {
  const [activeTab, setActiveTab] = useState('dealership'); // 'dealership' | 'hangar'
  const [catalog, setCatalog] = useState([]);
  const [hangarData, setHangarData] = useState({ fleet: [], activeAircraft: null, balance: 0 });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [sellModalPlane, setSellModalPlane] = useState(null);
  const [returnModalPlane, setReturnModalPlane] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [catRes, hangRes] = await Promise.all([fetchAircraftCatalog(), fetchHangar()]);
        if (isMounted) {
          setCatalog(catRes.catalog || []);
          setHangarData({
            fleet: hangRes.fleet || [],
            activeAircraft: hangRes.activeAircraft,
            balance: hangRes.balance || pilot?.balance || 0
          });
        }
      } catch (err) {
        console.error('Failed to load fleet data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [pilot]);

  const currentBalance = pilot?.balance !== undefined ? pilot.balance : (hangarData.balance || 0);
  const activeTail = hangarData.activeAircraft?.tail_number || pilot?.active_aircraft?.tail_number;

  const handleBuy = async (plane) => {
    if (currentBalance < plane.purchase_price) {
      alert(`Insufficient funds. You need $${(plane.purchase_price - currentBalance).toLocaleString()} more.`);
      return;
    }

    if (!confirm(`Confirm purchase of ${plane.name} for $${plane.purchase_price.toLocaleString()}?`)) {
      return;
    }

    try {
      setActionLoading(`buy-${plane.model_id}`);
      const res = await buyAircraft(plane.model_id);
      setFeedback({ type: 'success', message: res.message });
      setHangarData({
        fleet: res.pilot.fleet || [],
        activeAircraft: res.activeAircraft,
        balance: res.pilot.balance
      });
      if (onAircraftChanged) onAircraftChanged(res.pilot, res.activeAircraft);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRent = async (plane) => {
    if (currentBalance < plane.rental_price_per_flight) {
      alert(`Insufficient funds for rental fee of $${plane.rental_price_per_flight.toLocaleString()}.`);
      return;
    }

    if (!confirm(`Rent ${plane.name} for this flight? Fee of $${plane.rental_price_per_flight.toLocaleString()} will be deducted.`)) {
      return;
    }

    try {
      setActionLoading(`rent-${plane.model_id}`);
      const res = await rentAircraft(plane.model_id);
      setFeedback({ type: 'success', message: res.message });
      setHangarData({
        fleet: res.pilot.fleet || [],
        activeAircraft: res.activeAircraft,
        balance: res.pilot.balance
      });
      if (onAircraftChanged) onAircraftChanged(res.pilot, res.activeAircraft);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectActive = async (fleetPlane) => {
    try {
      setActionLoading(`select-${fleetPlane.tail_number}`);
      const res = await selectActiveAircraft(fleetPlane.model_id, fleetPlane.tail_number);
      setFeedback({ type: 'success', message: res.message });
      setHangarData((prev) => ({
        ...prev,
        activeAircraft: res.activeAircraft
      }));
      if (onAircraftChanged) onAircraftChanged(res.pilot, res.activeAircraft);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmSell = async (plane) => {
    try {
      setActionLoading(`sell-${plane.tail_number}`);
      const res = await sellAircraft(plane.tail_number);
      setFeedback({ type: 'success', message: res.message });
      setHangarData({
        fleet: res.pilot.fleet || [],
        activeAircraft: res.activeAircraft,
        balance: res.pilot.balance
      });
      setSellModalPlane(null);
      if (onAircraftChanged) onAircraftChanged(res.pilot, res.activeAircraft);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReturn = async (plane) => {
    try {
      setActionLoading(`return-${plane.tail_number}`);
      const res = await returnAircraft(plane.tail_number);
      setFeedback({ type: 'success', message: res.message });
      setHangarData({
        fleet: res.pilot.fleet || [],
        activeAircraft: res.activeAircraft,
        balance: res.pilot.balance
      });
      setReturnModalPlane(null);
      if (onAircraftChanged) onAircraftChanged(res.pilot, res.activeAircraft);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCatalog = catalog.filter((plane) => {
    if (categoryFilter === 'all') return true;
    return plane.category === categoryFilter;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Fleet Header */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800/90 bg-slate-900/60 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-950/70 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-md">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white font-mono tracking-wide">
              AIRCRAFT FLEET & HANGAR
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Active Cockpit Plane: <strong className="text-cyan-300">{hangarData.activeAircraft?.name || 'Cessna 172'}</strong> ({activeTail || 'N172AB'})
            </p>
          </div>
        </div>

        {/* Current Balance */}
        <div className="flex items-center space-x-2 bg-emerald-950/60 border border-emerald-800/50 px-4 py-2.5 rounded-xl font-mono">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400 text-xs">AVAILABLE BALANCE:</span>
          <span className="text-emerald-400 font-bold text-base sm:text-lg">
            ${currentBalance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tab Switcher & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setActiveTab('dealership');
              setFeedback(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'dealership'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>AIRCRAFT DEALERSHIP</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('hangar');
              setFeedback(null);
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition ${
              activeTab === 'hangar'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>MY HANGAR</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-cyan-300 ml-1">
              {hangarData.fleet?.length || 0}
            </span>
          </button>
        </div>

        {/* Category Filter */}
        {activeTab === 'dealership' && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
            {['all', 'single_prop', 'turboprop', 'jet', 'airliner'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg uppercase transition ${
                  categoryFilter === cat
                    ? 'bg-slate-800 text-cyan-400 font-bold border border-cyan-800/60'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between text-xs font-mono border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 font-mono text-sm">
          <Plane className="w-8 h-8 text-cyan-400 mx-auto animate-bounce mb-3" />
          Loading aircraft fleet catalog...
        </div>
      ) : activeTab === 'dealership' ? (
        /* DEALERSHIP */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalog.map((plane) => {
            const canAffordBuy = currentBalance >= plane.purchase_price;
            const canAffordRent = currentBalance >= plane.rental_price_per_flight;
            const ownedInHangar = (hangarData.fleet || []).some(
              (f) => f.model_id === plane.model_id && !f.is_rental
            );
            const isActive = hangarData.activeAircraft?.model_id === plane.model_id;

            return (
              <div
                key={plane.model_id}
                className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                  isActive
                    ? 'bg-gradient-to-b from-cyan-950/40 via-slate-900/80 to-slate-900/60 border-cyan-500/60 shadow-xl shadow-cyan-950/40'
                    : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
                }`}
              >
                <div>
                  {/* Title */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                          {plane.manufacturer || 'MSFS 2024'}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 flex items-center space-x-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>ACTIVE</span>
                          </span>
                        )}
                        {ownedInHangar && !isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                            OWNED
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white font-mono tracking-wide mt-0.5">
                        {plane.name}
                      </h3>
                    </div>

                    <span className="px-2 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-slate-800 text-cyan-300 border border-slate-700 whitespace-nowrap">
                      {plane.category.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed line-clamp-2">
                    {plane.description}
                  </p>

                  {/* Specifications Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-[11px] font-mono">
                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <Gauge className="w-3 h-3 text-cyan-400" />
                        <span>SPEED</span>
                      </span>
                      <span className="text-white font-bold block mt-0.5">
                        {plane.cruise_speed_kts} KTS
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <Compass className="w-3 h-3 text-blue-400" />
                        <span>RANGE</span>
                      </span>
                      <span className="text-white font-bold block mt-0.5">
                        {plane.max_range_nm.toLocaleString()} NM
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <Package className="w-3 h-3 text-amber-400" />
                        <span>CARGO</span>
                      </span>
                      <span className="text-white font-bold block mt-0.5">
                        {plane.max_cargo_lbs.toLocaleString()} lbs
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <Users className="w-3 h-3 text-indigo-400" />
                        <span>PAX</span>
                      </span>
                      <span className="text-white font-bold block mt-0.5">
                        {plane.max_pax} seats
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 block">MIN RWY</span>
                      <span className="text-white font-bold block mt-0.5">
                        {plane.min_runway_ft.toLocaleString()} ft
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                      <span className="text-slate-500 flex items-center space-x-1">
                        <Fuel className="w-3 h-3 text-rose-400" />
                        <span>BURN</span>
                      </span>
                      <span className="text-white font-bold block mt-0.5">
                        {plane.fuel_burn_gph} GPH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Purchase & Rent Actions */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">PRICE:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      ${plane.purchase_price.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleBuy(plane)}
                      disabled={!canAffordBuy || actionLoading !== null}
                      className={`w-full py-2 px-2.5 rounded-xl font-mono text-[11px] font-bold transition flex items-center justify-center space-x-1 ${
                        canAffordBuy
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                          : 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                      }`}
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>{canAffordBuy ? 'BUY' : 'CANNOT AFFORD'}</span>
                    </button>

                    <button
                      onClick={() => handleRent(plane)}
                      disabled={!canAffordRent || actionLoading !== null}
                      className={`w-full py-2 px-2.5 rounded-xl font-mono text-[11px] font-bold transition flex items-center justify-center space-x-1 ${
                        canAffordRent
                          ? 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 hover:border-cyan-500'
                          : 'bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>RENT (${plane.rental_price_per_flight.toLocaleString()})</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MY HANGAR */
        <div className="space-y-4">
          {hangarData.fleet && hangarData.fleet.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hangarData.fleet.map((plane, idx) => {
                const isActive =
                  hangarData.activeAircraft?.tail_number === plane.tail_number ||
                  (!hangarData.activeAircraft?.tail_number && idx === 0);
                const modelSpecs = catalog.find((c) => c.model_id === plane.model_id) || {};

                return (
                  <div
                    key={plane.tail_number || idx}
                    className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                      isActive
                        ? 'bg-gradient-to-b from-cyan-950/50 via-slate-900/90 to-slate-900/70 border-cyan-400 shadow-xl shadow-cyan-950/50'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xl font-bold text-white font-mono tracking-wider">
                              {plane.tail_number}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-200 mt-1 font-mono">
                            {plane.name}
                          </h4>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase border ${
                            !plane.is_rental
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                              : plane.tail_number?.endsWith('LN') || plane.name?.includes('Loaner')
                              ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                          }`}
                        >
                          {!plane.is_rental
                            ? 'OWNED'
                            : plane.tail_number?.endsWith('LN') || plane.name?.includes('Loaner')
                            ? 'FREE LOANER'
                            : 'RENTAL'}
                        </span>
                      </div>

                      {/* Flight Hours & Category Banner */}
                      <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 mt-3 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 text-[10px] block">LOGGED FLIGHT TIME</span>
                          <span className="text-cyan-400 font-bold">
                            {(plane.flight_hours || 0).toFixed(1)} HOURS
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 text-[10px] block">TIER CLASS</span>
                          <span className="text-white font-bold uppercase">
                            {(plane.category || modelSpecs.category || 'single_prop').replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* 6 Aircraft Specification Stat Cards */}
                      <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] font-mono">
                        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <Gauge className="w-3 h-3 text-cyan-400" />
                            <span>SPEED</span>
                          </span>
                          <span className="text-white font-bold block mt-0.5">
                            {modelSpecs.cruise_speed_kts || 120} KTS
                          </span>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <Compass className="w-3 h-3 text-blue-400" />
                            <span>RANGE</span>
                          </span>
                          <span className="text-white font-bold block mt-0.5">
                            {(modelSpecs.max_range_nm || 500).toLocaleString()} NM
                          </span>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <Package className="w-3 h-3 text-amber-400" />
                            <span>CARGO</span>
                          </span>
                          <span className="text-white font-bold block mt-0.5">
                            {(modelSpecs.max_cargo_lbs || 500).toLocaleString()} lbs
                          </span>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <Users className="w-3 h-3 text-indigo-400" />
                            <span>PAX</span>
                          </span>
                          <span className="text-white font-bold block mt-0.5">
                            {modelSpecs.max_pax || 3} seats
                          </span>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 block">MIN RWY</span>
                          <span className="text-white font-bold block mt-0.5">
                            {(modelSpecs.min_runway_ft || 1600).toLocaleString()} ft
                          </span>
                        </div>

                        <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                          <span className="text-slate-500 flex items-center space-x-1">
                            <Fuel className="w-3 h-3 text-rose-400" />
                            <span>BURN</span>
                          </span>
                          <span className="text-white font-bold block mt-0.5">
                            {modelSpecs.fuel_burn_gph || 9} GPH
                          </span>
                        </div>
                      </div>

                      {/* Resale Value & Depreciation Pill for Owned Aircraft */}
                      {!plane.is_rental && (
                        <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/60 px-3 py-2 rounded-xl mt-3 text-xs font-mono">
                          <div>
                            <span className="text-emerald-400/80 text-[10px] block">ESTIMATED RESALE VALUE</span>
                            <span className="text-emerald-300 font-bold text-sm">
                              +${(plane.resale_value || Math.round((modelSpecs.purchase_price || 150000) * 0.85)).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 text-[10px] block">TOTAL DEPRECIATION</span>
                            <span className="text-rose-400 font-bold">
                              -{(plane.depreciation_percent ?? 15)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
                      {isActive ? (
                        <div className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold text-center flex items-center justify-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          <span>CURRENT ACTIVE COCKPIT PLANE</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectActive(plane)}
                          disabled={actionLoading !== null}
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 border border-slate-700 hover:border-cyan-500 font-mono text-xs font-bold transition flex items-center justify-center space-x-2"
                        >
                          <Plane className="w-4 h-4" />
                          <span>SELECT AS ACTIVE AIRCRAFT</span>
                        </button>
                      )}

                      {plane.is_rental ? (
                        <button
                          onClick={() => setReturnModalPlane(plane)}
                          disabled={actionLoading !== null}
                          className="w-full py-2 px-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 font-mono text-xs font-bold transition flex items-center justify-center space-x-2"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>RETURN LEASE TO LESSOR</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setSellModalPlane(plane)}
                          disabled={actionLoading !== null}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 font-mono text-xs font-bold transition flex items-center justify-center space-x-2"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span>SELL AIRCRAFT (+${(plane.resale_value || Math.round((modelSpecs.purchase_price || 150000) * 0.85)).toLocaleString()})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center font-mono">
              <Warehouse className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Your hangar is currently empty.</p>
              <p className="text-xs text-slate-500 mt-1">
                Visit the Dealership tab to acquire aircraft with your career earnings!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sell Confirmation Modal */}
      {sellModalPlane && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400">
                <DollarSign className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">SELL OWNED AIRCRAFT</h3>
              </div>
              <button
                onClick={() => setSellModalPlane(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="text-sm font-bold text-white">{sellModalPlane.name}</div>
              <div className="text-xs text-slate-400">
                Tail Number: <span className="text-cyan-400 font-bold">{sellModalPlane.tail_number}</span>
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Original Catalog Price:</span>
                <span>${(sellModalPlane.catalog_purchase_price || sellModalPlane.purchase_price || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Base Resale Depreciation (-{sellModalPlane.base_depreciation_percent ?? 15}%):</span>
                <span>-${Math.round((sellModalPlane.catalog_purchase_price || sellModalPlane.purchase_price || 0) * ((sellModalPlane.base_depreciation_percent ?? 15) / 100)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Flight Hours Wear (-{(sellModalPlane.hourly_depreciation_percent ?? (Math.round((sellModalPlane.flight_hours || 0) * 0.5 * 10) / 10))}% for {(sellModalPlane.flight_hours || 0).toFixed(1)} hrs):</span>
                <span>-${Math.round((sellModalPlane.catalog_purchase_price || sellModalPlane.purchase_price || 0) * ((sellModalPlane.hourly_depreciation_percent ?? (Math.round((sellModalPlane.flight_hours || 0) * 0.5 * 10) / 10)) / 100)).toLocaleString()}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm text-emerald-400">
                <span>Net Sale Proceeds:</span>
                <span>+${(sellModalPlane.resale_value || 0).toLocaleString()}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Proceeds will be deposited into your pilot wallet immediately, and this aircraft will be removed from your hangar.
            </p>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setSellModalPlane(null)}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleConfirmSell(sellModalPlane)}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 transition flex items-center justify-center space-x-1"
              >
                {actionLoading === `sell-${sellModalPlane.tail_number}` ? (
                  <span>SELLING...</span>
                ) : (
                  <span>CONFIRM SALE (+${(sellModalPlane.resale_value || 0).toLocaleString()})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Confirmation Modal */}
      {returnModalPlane && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-amber-400">
                <Undo2 className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">RETURN LEASED AIRCRAFT</h3>
              </div>
              <button
                onClick={() => setReturnModalPlane(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to return <strong className="text-white">{returnModalPlane.name}</strong> (<span className="text-cyan-300 font-bold">{returnModalPlane.tail_number}</span>) to the fleet lessor?
            </p>

            <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              This will terminate your lease and remove the aircraft from your hangar. If this plane is currently active in your cockpit, your flight deck will automatically switch to your next available aircraft.
            </p>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setReturnModalPlane(null)}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleConfirmReturn(returnModalPlane)}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950/60 transition flex items-center justify-center space-x-1"
              >
                {actionLoading === `return-${returnModalPlane.tail_number}` ? (
                  <span>RETURNING...</span>
                ) : (
                  <span>CONFIRM RETURN</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FleetView;

