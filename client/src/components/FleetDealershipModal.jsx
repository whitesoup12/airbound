import React, { useState, useEffect } from 'react';
import {
  X,
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
} from '../api/client.js';
import DialogModal from './common/DialogModal.jsx';

export function FleetDealershipModal({ isOpen, onClose, pilot, onAircraftChanged }) {
  const [activeTab, setActiveTab] = useState('dealership'); // 'dealership' | 'hangar'
  const [catalog, setCatalog] = useState([]);
  const [hangarData, setHangarData] = useState({ fleet: [], activeAircraft: null, balance: 0 });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [sellModalPlane, setSellModalPlane] = useState(null);
  const [returnModalPlane, setReturnModalPlane] = useState(null);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    details: '',
    type: 'confirm',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null
  });

  // Load catalog and hangar on open
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, pilot]);

  if (!isOpen) return null;

  const currentBalance = pilot?.balance !== undefined ? pilot.balance : (hangarData.balance || 0);
  const activeTail = hangarData.activeAircraft?.tail_number || pilot?.active_aircraft?.tail_number;

  const executeBuy = async (plane) => {
    try {
      setActionLoading(`buy-${plane.tail_number || plane.model_id}`);
      const res = await buyAircraft(plane.model_id, plane.tail_number || '');
      setFeedback({ type: 'success', message: res.message });

      const [catRes, hangRes] = await Promise.all([fetchAircraftCatalog(), fetchHangar()]);
      setCatalog(catRes.catalog || []);
      setHangarData({
        fleet: hangRes.fleet || res.pilot.fleet || [],
        activeAircraft: hangRes.activeAircraft || res.activeAircraft,
        balance: hangRes.balance !== undefined ? hangRes.balance : res.pilot.balance,
        rentToOwnEquity: hangRes.rentToOwnEquity || {}
      });
      if (onAircraftChanged) onAircraftChanged(res.pilot, res.activeAircraft);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBuy = (plane) => {
    const equity = plane.accumulated_equity || (hangarData.rentToOwnEquity && Number(hangarData.rentToOwnEquity[plane.model_id])) || 0;
    const effectivePrice = Math.max(0, (plane.purchase_price || plane.catalog_purchase_price || 0) - equity);

    if (currentBalance < effectivePrice) {
      setDialogState({
        isOpen: true,
        title: 'Insufficient Funds',
        type: 'warning',
        message: `Buyout price is $${effectivePrice.toLocaleString()} (after applying $${equity.toLocaleString()} Rent-to-Own equity credit). You need $${(effectivePrice - currentBalance).toLocaleString()} more.`,
        details: `Available Company Balance: $${currentBalance.toLocaleString()} • Purchase Target: $${effectivePrice.toLocaleString()}`,
        confirmText: 'Understood',
        cancelText: null
      });
      return;
    }

    const confirmMsg = equity > 0
      ? effectivePrice === 0
        ? `Claim permanent ownership of ${plane.name} for FREE? (100% paid off through accumulated Rent-to-Own credits!)`
        : `Confirm buyout of ${plane.name} for $${effectivePrice.toLocaleString()}? ($${equity.toLocaleString()} accumulated Rent-to-Own credit applied!)`
      : `Confirm purchase of ${plane.name} for $${plane.purchase_price.toLocaleString()}?`;

    setDialogState({
      isOpen: true,
      title: equity > 0 ? 'Confirm Rent-to-Own Buyout' : 'Confirm Aircraft Purchase',
      type: 'confirm',
      message: confirmMsg,
      details: `This aircraft will be permanently registered to your company hangar. Cruise Speed: ${plane.cruise_speed_kts} KTS • Range: ${plane.max_range_nm} NM`,
      confirmText: effectivePrice === 0 ? 'Claim Aircraft' : 'Confirm Purchase',
      cancelText: 'Cancel',
      onConfirm: () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        executeBuy(plane);
      }
    });
  };

  const executeRent = async (plane) => {
    try {
      setActionLoading(`rent-${plane.model_id}`);
      const res = await rentAircraft(plane.model_id);
      setFeedback({ type: 'success', message: res.message });

      const [catRes, hangRes] = await Promise.all([fetchAircraftCatalog(), fetchHangar()]);
      setCatalog(catRes.catalog || []);
      setHangarData({
        fleet: hangRes.fleet || res.pilot.fleet || [],
        activeAircraft: hangRes.activeAircraft || res.activeAircraft,
        balance: hangRes.balance !== undefined ? hangRes.balance : res.pilot.balance,
        rentToOwnEquity: hangRes.rentToOwnEquity || {}
      });
      if (onAircraftChanged) onAircraftChanged(res.pilot, res.activeAircraft);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRent = (plane) => {
    if (currentBalance < plane.rental_price_per_flight) {
      setDialogState({
        isOpen: true,
        title: 'Insufficient Rental Funds',
        type: 'warning',
        message: `You do not have enough company funds for the rental fee of $${plane.rental_price_per_flight.toLocaleString()}.`,
        details: `Available Company Balance: $${currentBalance.toLocaleString()} • Required Rental Fee: $${plane.rental_price_per_flight.toLocaleString()}`,
        confirmText: 'Understood',
        cancelText: null
      });
      return;
    }

    const equityCredit = Math.round(plane.rental_price_per_flight * 0.75);
    setDialogState({
      isOpen: true,
      title: 'Confirm Aircraft Rental',
      type: 'confirm',
      message: `Rent ${plane.name} for your next flight? The rental fee of $${plane.rental_price_per_flight.toLocaleString()} will be charged to your wallet.`,
      details: `Rent-to-Own Incentive: +$${equityCredit.toLocaleString()} (75%) will be credited toward permanently purchasing this aircraft! Cruise Speed: ${plane.cruise_speed_kts} KTS`,
      confirmText: 'Rent Aircraft',
      cancelText: 'Cancel',
      onConfirm: () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        executeRent(plane);
      }
    });
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
      const [catRes, hangRes] = await Promise.all([fetchAircraftCatalog(), fetchHangar()]);
      setCatalog(catRes.catalog || []);
      setHangarData({
        fleet: hangRes.fleet || res.pilot.fleet || [],
        activeAircraft: hangRes.activeAircraft || res.activeAircraft,
        balance: hangRes.balance !== undefined ? hangRes.balance : res.pilot.balance,
        rentToOwnEquity: hangRes.rentToOwnEquity || {}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl glass-panel border border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shadow-md">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono tracking-wide">
                AIRCRAFT FLEET & HANGAR
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Active Flight: <strong className="text-cyan-400">{hangarData.activeAircraft?.name || 'Cessna 152'}</strong> ({activeTail || 'N152AB'})
              </p>
            </div>
          </div>

          {/* Balance & Close Button */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 font-mono text-xs sm:text-sm font-bold">
              <DollarSign className="w-4 h-4" />
              <span>{currentBalance.toLocaleString()}</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-900/40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setActiveTab('dealership');
                setFeedback(null);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition ${
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition ${
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

          {/* Dealership Category Filter */}
          {activeTab === 'dealership' && (
            <div className="hidden sm:flex items-center space-x-1 text-[11px] font-mono">
              {['all', 'single_prop', 'twin_prop', 'turboprop', 'jet', 'airliner'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg uppercase transition ${
                    categoryFilter === cat
                      ? 'bg-slate-800 text-cyan-400 font-bold border border-cyan-800/60'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feedback Alert if present */}
        {feedback && (
          <div
            className={`px-5 py-2.5 flex items-center justify-between text-xs font-mono ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-b border-rose-800'
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

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-mono text-sm">
              <Plane className="w-8 h-8 text-cyan-400 mx-auto animate-bounce mb-3" />
              Loading fleet and dealership models...
            </div>
          ) : activeTab === 'dealership' ? (
            /* DEALERSHIP TAB */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCatalog.map((plane) => {
                const equity = plane.accumulated_equity || (hangarData.rentToOwnEquity && Number(hangarData.rentToOwnEquity[plane.model_id])) || 0;
                const effectivePrice = Math.max(0, plane.purchase_price - equity);
                const equityPercent = Math.min(100, Math.round((equity / plane.purchase_price) * 100));
                const canAffordBuy = currentBalance >= effectivePrice;
                const canAffordRent = currentBalance >= plane.rental_price_per_flight;
                const ownedInHangar = (hangarData.fleet || []).some(
                  (f) => f.model_id === plane.model_id && !f.is_rental
                );
                const isRentalInHangar = (hangarData.fleet || []).some(
                  (f) => f.model_id === plane.model_id && f.is_rental
                );
                const isActive = hangarData.activeAircraft?.model_id === plane.model_id;

                return (
                  <div
                    key={plane.model_id}
                    className={`rounded-2xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between ${
                      isActive
                        ? 'bg-gradient-to-b from-cyan-950/40 via-slate-900/80 to-slate-900/60 border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                        : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
                    }`}
                  >
                    <div>
                      {/* Title & Category Badge */}
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
                          <h3 className="text-base sm:text-lg font-bold text-white font-mono tracking-wide mt-0.5">
                            {plane.name}
                          </h3>
                        </div>

                        <span className="px-2 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                          {plane.category.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {plane.description}
                      </p>

                      {/* Technical Specifications Grid */}
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
                          <span className="text-slate-500 block">MIN RUNWAY</span>
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
                            {plane.fuel_burn_gph} GPH ({plane.fuel_type})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Purchase & Rental */}
                    <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2.5">
                      {/* Rent-to-Own Accrued Equity Bar */}
                      {equity > 0 && (
                        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-emerald-400 font-bold flex items-center space-x-1">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>RENT-TO-OWN ACCRUED EQUITY</span>
                            </span>
                            <span className="text-emerald-300 font-bold">
                              ${equity.toLocaleString()} ({equityPercent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-900/80 rounded-full h-1.5 overflow-hidden border border-emerald-900/50">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(2, equityPercent))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">
                          {equity > 0 ? 'BUYOUT BALANCE:' : 'PURCHASE PRICE:'}
                        </span>
                        <div className="text-right">
                          {equity > 0 && (
                            <span className="line-through text-slate-500 text-[11px] mr-2">
                              ${plane.purchase_price.toLocaleString()}
                            </span>
                          )}
                          <span className={`${effectivePrice === 0 ? 'text-emerald-300' : 'text-emerald-400'} font-bold text-sm`}>
                            {effectivePrice === 0 ? 'FREE ($0)' : `$${effectivePrice.toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Buy / Buyout Button */}
                        <button
                          onClick={() => handleBuy(plane)}
                          disabled={!canAffordBuy || actionLoading !== null}
                          className={`w-full py-2 px-3 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                            canAffordBuy
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                              : 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>
                            {effectivePrice === 0
                              ? 'CLAIM OWNERSHIP (FREE)'
                              : equity > 0
                              ? canAffordBuy
                                ? `BUYOUT ($${effectivePrice.toLocaleString()})`
                                : `NEED $${(effectivePrice - currentBalance).toLocaleString()}`
                              : canAffordBuy
                              ? 'BUY AIRCRAFT'
                              : `NEED $${(plane.purchase_price - currentBalance).toLocaleString()}`}
                          </span>
                        </button>

                        {/* Rent Button */}
                        <button
                          onClick={() => handleRent(plane)}
                          disabled={!canAffordRent || actionLoading !== null}
                          className={`w-full py-1.5 px-3 rounded-xl font-mono text-xs font-bold transition flex flex-col items-center justify-center ${
                            canAffordRent
                              ? 'bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 hover:border-cyan-500'
                              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>RENT (${plane.rental_price_per_flight.toLocaleString()})</span>
                          </div>
                          <span className="text-[9px] text-cyan-400/80 font-normal mt-0.5">
                            +${(plane.rental_equity_per_flight || Math.round(plane.rental_price_per_flight * 0.75)).toLocaleString()} equity/flight
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* MY HANGAR TAB */
            <div className="space-y-4">
              {hangarData.fleet && hangarData.fleet.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hangarData.fleet.map((plane, idx) => {
                    const isActive =
                      hangarData.activeAircraft?.tail_number === plane.tail_number ||
                      (!hangarData.activeAircraft?.tail_number && idx === 0);
                    const modelSpecs = catalog.find((c) => c.model_id === plane.model_id) || {};
                    const rentalEquity = plane.accumulated_equity || (hangarData.rentToOwnEquity && Number(hangarData.rentToOwnEquity[plane.model_id])) || 0;
                    const fullPurchasePrice = modelSpecs.purchase_price || plane.catalog_purchase_price || 0;
                    const buyoutPrice = plane.remaining_buyout_price !== undefined ? plane.remaining_buyout_price : Math.max(0, fullPurchasePrice - rentalEquity);
                    const equityPercent = plane.equity_percent !== undefined ? plane.equity_percent : (fullPurchasePrice > 0 ? Math.min(100, Math.round((rentalEquity / fullPurchasePrice) * 100)) : 0);
                    const canAffordBuyout = currentBalance >= buyoutPrice;
                    const rentalEquityPerFlight = plane.rental_equity_per_flight || Math.round((modelSpecs.rental_price_per_flight || 0) * 0.75);

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
                                    ACTIVE FLIGHT
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
                                ? 'OWNED FLEET'
                                : plane.tail_number?.endsWith('LN') || plane.name?.includes('Loaner')
                                ? 'FREE LOANER'
                                : 'RENTAL LEASE'}
                            </span>
                          </div>

                          {/* Flight Hours & Tier Class */}
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

                          {/* Rent-to-Own Equity Card for Leased Aircraft */}
                          {plane.is_rental && (
                            <div className="bg-emerald-950/30 border border-emerald-700/50 px-3 py-2.5 rounded-xl mt-3 text-xs font-mono space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-emerald-400 font-bold text-[10px] flex items-center space-x-1">
                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                    <span>RENT-TO-OWN ACCRUED EQUITY</span>
                                  </span>
                                  <span className="text-emerald-300 font-bold text-sm">
                                    ${rentalEquity.toLocaleString()}
                                    <span className="text-slate-400 text-[10px] font-normal ml-1">
                                      / ${fullPurchasePrice.toLocaleString()} ({equityPercent}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-slate-400 text-[10px] block">REMAINING BUYOUT</span>
                                  <span className="text-white font-bold text-sm">
                                    {buyoutPrice === 0 ? (
                                      <span className="text-emerald-400 font-bold">FREE ($0)</span>
                                    ) : (
                                      `$${buyoutPrice.toLocaleString()}`
                                    )}
                                  </span>
                                </div>
                              </div>
                              {/* Progress Bar */}
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-emerald-900/60">
                                <div
                                  className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(2, equityPercent))}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>75% of rental payments credited</span>
                                <span className="text-cyan-400 font-medium">
                                  +${rentalEquityPerFlight.toLocaleString()} / flight
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
                          {isActive ? (
                            <div className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono text-xs font-bold text-center flex items-center justify-center space-x-2">
                              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                              <span>CURRENTLY READY IN COCKPIT</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSelectActive(plane)}
                              disabled={actionLoading !== null}
                              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 border border-slate-700 hover:border-cyan-500 font-mono text-xs font-bold transition flex items-center justify-center space-x-2"
                            >
                              <Plane className="w-4 h-4" />
                              <span>SELECT AS ACTIVE FLIGHT AIRCRAFT</span>
                            </button>
                          )}

                          {plane.is_rental ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleBuy({ ...modelSpecs, ...plane, purchase_price: fullPurchasePrice, accumulated_equity: rentalEquity })}
                                disabled={!canAffordBuyout || actionLoading !== null}
                                className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                                  canAffordBuyout
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                                    : 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                                }`}
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>
                                  {buyoutPrice === 0
                                    ? 'CLAIM (FREE)'
                                    : canAffordBuyout
                                    ? `BUYOUT ($${buyoutPrice.toLocaleString()})`
                                    : `NEED $${(buyoutPrice - currentBalance).toLocaleString()}`}
                                </span>
                              </button>
                              <button
                                onClick={() => setReturnModalPlane(plane)}
                                disabled={actionLoading !== null}
                                className="py-2 px-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 font-mono text-xs font-bold transition flex items-center justify-center space-x-1.5"
                              >
                                <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                                <span>RETURN LEASE</span>
                              </button>
                            </div>
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
                <div className="py-20 text-center font-mono">
                  <Warehouse className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Your hangar is currently empty.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Visit the Dealership tab to acquire aircraft with your career earnings!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sell Confirmation Modal */}
      {sellModalPlane && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
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

            {/* Note about preserved Rent-to-Own equity */}
            {((returnModalPlane.accumulated_equity || (hangarData.rentToOwnEquity && Number(hangarData.rentToOwnEquity[returnModalPlane.model_id])) || 0) > 0) && (
              <p className="text-[11px] text-emerald-300/90 leading-relaxed bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/60">
                ✨ <strong>Your Rent-to-Own equity is safe!</strong> Your accrued credit of <strong>${(returnModalPlane.accumulated_equity || (hangarData.rentToOwnEquity && Number(hangarData.rentToOwnEquity[returnModalPlane.model_id])) || 0).toLocaleString()}</strong> remains banked on your pilot profile for whenever you decide to lease or buyout this model again.
              </p>
            )}

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

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-mono">
            Selecting an aircraft automatically customizes contracts on the Dispatch Board.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs transition"
          >
            Close
          </button>
        </div>
      </div>

      <DialogModal
        {...dialogState}
        onClose={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default FleetDealershipModal;

