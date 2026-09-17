import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Fuel,
  Sparkles,
  Plane,
  MapPin,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Percent,
  Calendar,
  Layers,
  ArrowRight,
  Receipt,
  Warehouse,
  Coins,
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export function CashFlowView({
  pilot,
  allAirports = [],
  onSwitchToDispatch,
  onSwitchToFleet
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'dispatch' | 'bonus' | 'expenses'
  const [sortField, setSortField] = useState('completed_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedFlightId, setExpandedFlightId] = useState(null);

  const flightLog = useMemo(() => pilot?.flight_log || [], [pilot?.flight_log]);
  const balance = pilot?.balance || 0;
  const STARTING_BALANCE = 15000;

  // Airport dictionary lookup
  const airportMap = useMemo(() => {
    const map = new Map();
    for (const a of allAirports) {
      if (a.icao) map.set(a.icao.toUpperCase(), a);
    }
    return map;
  }, [allAirports]);

  // Aggregate financial metrics
  const financialTotals = useMemo(() => {
    let grossRevenue = 0;
    let netPayout = 0;
    let fuelCost = 0;
    let fuelGallons = 0;
    let landingFees = 0;
    let explorationBonuses = 0;
    let dispatchCount = 0;
    let totalDistanceNm = 0;

    for (const f of flightLog) {
      const gross = f.gross_payout || f.payout || 0;
      const net = f.net_payout || f.payout || 0;
      const fuel = f.fuel_cost || 0;
      const gal = f.fuel_gallons || 0;
      const landing = f.landing_fee || 0;
      const bonus = f.exploration_bonus || 0;
      const dist = f.distance_nm || 0;

      grossRevenue += gross;
      netPayout += net;
      fuelCost += fuel;
      fuelGallons += gal;
      landingFees += landing;
      explorationBonuses += bonus;
      totalDistanceNm += dist;

      if (f.source === 'airbound_dispatch' || fuel > 0 || landing > 0 || f.gross_payout > 0) {
        dispatchCount++;
      }
    }

    const totalOperatingExpenses = fuelCost + landingFees;
    const profitMargin = grossRevenue > 0 ? (netPayout / grossRevenue) * 100 : 100;
    const avgGrossPerFlight = dispatchCount > 0 ? grossRevenue / dispatchCount : 0;
    const avgNetPerFlight = dispatchCount > 0 ? netPayout / dispatchCount : 0;
    const avgFuelPerGal = fuelGallons > 0 ? fuelCost / fuelGallons : 6.0;
    const avgFuelPerNm = totalDistanceNm > 0 ? fuelCost / totalDistanceNm : 0;
    const careerNetGain = balance - STARTING_BALANCE;

    return {
      grossRevenue,
      netPayout,
      fuelCost,
      fuelGallons,
      landingFees,
      explorationBonuses,
      totalOperatingExpenses,
      profitMargin,
      dispatchCount,
      totalDistanceNm,
      avgGrossPerFlight,
      avgNetPerFlight,
      avgFuelPerGal,
      avgFuelPerNm,
      careerNetGain
    };
  }, [flightLog, balance]);

  // Filtered and sorted flight transactions
  const filteredFlights = useMemo(() => {
    let list = flightLog.map((f, idx) => ({
      ...f,
      _virtualId: f._id || `flight-${idx}`,
      gross_payout: f.gross_payout || f.payout || 0,
      net_payout: f.net_payout || f.payout || 0,
      fuel_cost: f.fuel_cost || 0,
      fuel_gallons: f.fuel_gallons || 0,
      landing_fee: f.landing_fee || 0,
      exploration_bonus: f.exploration_bonus || 0
    }));

    // Filter type
    if (filterType === 'dispatch') {
      list = list.filter((f) => f.source === 'airbound_dispatch' || f.gross_payout > 0 || f.fuel_cost > 0);
    } else if (filterType === 'bonus') {
      list = list.filter((f) => f.exploration_bonus > 0);
    } else if (filterType === 'expenses') {
      list = list.filter((f) => f.fuel_cost > 0 || f.landing_fee > 0);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => {
        const orig = (f.origin_icao || '').toLowerCase();
        const dest = (f.destination_icao || '').toLowerCase();
        const plane = (f.aircraft_name || '').toLowerCase();
        const origName = (airportMap.get(f.origin_icao?.toUpperCase())?.name || '').toLowerCase();
        const destName = (airportMap.get(f.destination_icao?.toUpperCase())?.name || '').toLowerCase();
        return (
          orig.includes(q) ||
          dest.includes(q) ||
          plane.includes(q) ||
          origName.includes(q) ||
          destName.includes(q)
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      switch (sortField) {
        case 'net_payout':
          valA = a.net_payout;
          valB = b.net_payout;
          break;
        case 'gross_payout':
          valA = a.gross_payout;
          valB = b.gross_payout;
          break;
        case 'fuel_cost':
          valA = a.fuel_cost;
          valB = b.fuel_cost;
          break;
        case 'landing_fee':
          valA = a.landing_fee;
          valB = b.landing_fee;
          break;
        case 'exploration_bonus':
          valA = a.exploration_bonus;
          valB = b.exploration_bonus;
          break;
        case 'completed_at':
        default:
          valA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          valB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          break;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [flightLog, filterType, searchQuery, sortField, sortAsc, airportMap]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const toggleExpandFlight = (id) => {
    setExpandedFlightId((prev) => (prev === id ? null : id));
  };

  // Percentages for visual breakdown bar
  const netShare = financialTotals.grossRevenue > 0
    ? (financialTotals.netPayout / financialTotals.grossRevenue) * 100
    : 100;
  const fuelShare = financialTotals.grossRevenue > 0
    ? (financialTotals.fuelCost / financialTotals.grossRevenue) * 100
    : 0;
  const landingShare = financialTotals.grossRevenue > 0
    ? (financialTotals.landingFees / financialTotals.grossRevenue) * 100
    : 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* 1. Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono tracking-wide uppercase flex items-center space-x-2">
                <span>CASH FLOW & FINANCIAL LEDGER</span>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/50">
                  REAL-TIME ECONOMICS
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Complete accounting of flight revenues, fuel expenses, exploration bonuses, and liquid capital.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {onSwitchToDispatch && (
            <button
              type="button"
              onClick={onSwitchToDispatch}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Dispatch Board</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}
          {onSwitchToFleet && (
            <button
              type="button"
              onClick={onSwitchToFleet}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Warehouse className="w-3.5 h-3.5 text-amber-400" />
              <span>Fleet Hangar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Primary 4-Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        {/* Card 1: Money in the Bank */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-emerald-800/60 shadow-lg shadow-emerald-950/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              OVERALL MONEY IN BANK
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-3xl font-extrabold text-emerald-400 block tracking-tight">
              ${balance.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Liquid capital available for fuel & fleet
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Seed: $15,000</span>
            <span className="text-emerald-300 font-bold">
              {financialTotals.careerNetGain >= 0 ? `+$${financialTotals.careerNetGain.toLocaleString()}` : `-$${Math.abs(financialTotals.careerNetGain).toLocaleString()}`} Net
            </span>
          </div>
        </div>

        {/* Card 2: Money Earned from Jobs */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-cyan-800/60 shadow-lg shadow-cyan-950/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              MONEY EARNED FROM JOBS
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-3xl font-extrabold text-cyan-400 block tracking-tight">
              ${financialTotals.grossRevenue.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Gross dispatch contract revenue
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">{financialTotals.dispatchCount} Dispatch Runs</span>
            <span className="text-cyan-300 font-bold">
              Avg ${Math.round(financialTotals.avgGrossPerFlight).toLocaleString()} / run
            </span>
          </div>
        </div>

        {/* Card 3: Fuel Paid */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-amber-800/60 shadow-lg shadow-amber-950/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              FUEL EXPENSES PAID
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-3xl font-extrabold text-amber-400 block tracking-tight">
              ${financialTotals.fuelCost.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              {financialTotals.fuelGallons.toFixed(1)} gal aviation fuel consumed
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">${financialTotals.avgFuelPerGal.toFixed(2)}/gal avg</span>
            <span className="text-amber-300 font-bold">
              ${financialTotals.avgFuelPerNm.toFixed(2)} / NM
            </span>
          </div>
        </div>

        {/* Card 4: Exploration Bonuses */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-purple-800/60 shadow-lg shadow-purple-950/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              EXPLORATION BONUSES
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-3xl font-extrabold text-purple-300 block tracking-tight">
              +${financialTotals.explorationBonuses.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Featured unvisited airfield incentives
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Discovery Missions</span>
            <span className="text-purple-300 font-bold">+$500 / unvisited field</span>
          </div>
        </div>
      </div>

      {/* 3. Revenue Retention & Operating Efficiency Bar */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <Percent className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-200 font-bold text-sm tracking-wide">
              OPERATING EFFICIENCY & CASH FLOW RETENTION
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400">
              Net Retained Profit:{' '}
              <strong className="text-emerald-400 font-bold text-sm">
                ${financialTotals.netPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold">
              {financialTotals.profitMargin.toFixed(1)}% Operating Margin
            </span>
          </div>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${Math.max(netShare, 0)}%` }}
              title={`Net Profit Retained: ${netShare.toFixed(1)}%`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.max(fuelShare, 0)}%` }}
              title={`Fuel Cost: ${fuelShare.toFixed(1)}%`}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${Math.max(landingShare, 0)}%` }}
              title={`Landing Fees: ${landingShare.toFixed(1)}%`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
              <span>
                Net Profit: <strong className="text-emerald-300">${financialTotals.netPayout.toFixed(2)}</strong> ({netShare.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              <span>
                Fuel Expenses: <strong className="text-amber-300">${financialTotals.fuelCost.toFixed(2)}</strong> ({fuelShare.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              <span>
                Airport Landing Fees: <strong className="text-rose-300">${financialTotals.landingFees.toFixed(2)}</strong> ({landingShare.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Two-Column Streams Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        {/* Income Sources */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white uppercase tracking-wider">INCOME STREAMS</span>
            </div>
            <span className="text-cyan-400 font-bold">
              ${financialTotals.grossRevenue.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span className="text-slate-400">Base Freight & Passenger Contracts</span>
              <span className="text-white font-semibold">
                ${(financialTotals.grossRevenue - financialTotals.explorationBonuses).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-400">Featured Discovery Bonuses</span>
              </div>
              <span className="text-purple-300 font-semibold">
                +${financialTotals.explorationBonuses.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <span className="text-slate-400">Average Payout per Flight</span>
              <span className="text-slate-300 font-semibold">
                ${Math.round(financialTotals.avgNetPerFlight).toLocaleString()} Net
              </span>
            </div>
          </div>
        </div>

        {/* Operating Deductions */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white uppercase tracking-wider">OPERATING EXPENDITURES</span>
            </div>
            <span className="text-amber-400 font-bold">
              -${financialTotals.totalOperatingExpenses.toFixed(2)}
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <div className="flex items-center space-x-1.5">
                <Fuel className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">Aviation Fuel (100LL & Jet-A)</span>
              </div>
              <span className="text-amber-300 font-semibold">
                -${financialTotals.fuelCost.toFixed(2)} ({financialTotals.fuelGallons.toFixed(1)} gal)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-slate-400">Airport Runway & Handling Fees</span>
              </div>
              <span className="text-rose-300 font-semibold">
                -${financialTotals.landingFees.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
              <div className="flex items-center space-x-1.5">
                <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Active Fleet Airframes</span>
              </div>
              <span className="text-slate-300 font-semibold">
                {pilot?.fleet?.length || 1} plane{pilot?.fleet?.length === 1 ? '' : 's'} registered
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Flight Settlement Transaction History (Ledger Table) */}
      <div className="glass-panel rounded-3xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6 space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-cyan-400" />
              <span>FLIGHT SETTLEMENT TRANSACTION HISTORY</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Itemized ledger of revenue, fuel consumption, and fees logged per mission.
            </p>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                filterType === 'all'
                  ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All ({flightLog.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('dispatch')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                filterType === 'dispatch'
                  ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Dispatches ({financialTotals.dispatchCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('bonus')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                filterType === 'bonus'
                  ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Discovery Bonuses
            </button>
            <button
              type="button"
              onClick={() => setFilterType('expenses')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                filterType === 'expenses'
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              With Expenses
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transactions by ICAO code, airport name, or aircraft..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition text-xs font-mono"
          />
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/60">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-900/60 select-none">
                <th
                  onClick={() => handleSort('completed_at')}
                  className="p-3.5 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center space-x-1">
                    <span>DATE</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="p-3.5">ROUTE</th>
                <th className="p-3.5">AIRCRAFT</th>
                <th
                  onClick={() => handleSort('gross_payout')}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>GROSS</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('exploration_bonus')}
                  className="p-3.5 cursor-pointer hover:text-white transition text-center"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>EXPLORATION</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('fuel_cost')}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>FUEL</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('landing_fee')}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>LANDING</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('net_payout')}
                  className="p-3.5 cursor-pointer hover:text-white transition text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>NET CASH FLOW</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="p-3.5 text-center">MARGIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredFlights.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No financial transactions match your current filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredFlights.map((flight) => {
                  const isExpanded = expandedFlightId === flight._virtualId;
                  const marginPct = flight.gross_payout > 0
                    ? ((flight.net_payout / flight.gross_payout) * 100).toFixed(0)
                    : '100';

                  const completedDateStr = flight.completed_at
                    ? new Date(flight.completed_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'MSFS Import';

                  const completedTimeStr = flight.completed_at
                    ? new Date(flight.completed_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '';

                  return (
                    <React.Fragment key={flight._virtualId}>
                      <tr
                        onClick={() => toggleExpandFlight(flight._virtualId)}
                        className={`hover:bg-slate-900/70 transition cursor-pointer ${
                          isExpanded ? 'bg-slate-900/80' : ''
                        }`}
                      >
                        {/* Date */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-slate-200 block font-semibold">{completedDateStr}</span>
                          {completedTimeStr && (
                            <span className="text-[10px] text-slate-500 block">{completedTimeStr}</span>
                          )}
                        </td>

                        {/* Route */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 font-bold">
                            <span className="text-slate-300">{flight.origin_icao || '—'}</span>
                            <span className="text-slate-500">➔</span>
                            <span className="text-cyan-400">{flight.destination_icao || '—'}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {Math.round(flight.distance_nm || 0)} NM
                          </span>
                        </td>

                        {/* Aircraft */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-slate-300 truncate max-w-[150px] block">
                            {flight.aircraft_name || 'C172 Skyhawk'}
                          </span>
                        </td>

                        {/* Gross Payout */}
                        <td className="p-3.5 text-right whitespace-nowrap font-semibold text-cyan-300">
                          {flight.gross_payout > 0 ? `$${flight.gross_payout.toLocaleString()}` : '—'}
                        </td>

                        {/* Exploration Bonus */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          {flight.exploration_bonus > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-700/60 font-bold text-[10px]">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>+${flight.exploration_bonus}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Fuel Expense */}
                        <td className="p-3.5 text-right whitespace-nowrap">
                          {flight.fuel_cost > 0 ? (
                            <div>
                              <span className="text-amber-400 font-semibold block">
                                -${flight.fuel_cost.toFixed(2)}
                              </span>
                              <span className="text-[9px] text-slate-500 block">
                                {flight.fuel_gallons} gal
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Landing Fee */}
                        <td className="p-3.5 text-right whitespace-nowrap">
                          {flight.landing_fee > 0 ? (
                            <span className="text-rose-400 font-semibold">
                              -${flight.landing_fee.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Net Cash Flow */}
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <span className="text-emerald-400 font-bold text-sm">
                            +${flight.net_payout.toLocaleString()}
                          </span>
                        </td>

                        {/* Margin */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              Number(marginPct) >= 90
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                : Number(marginPct) >= 75
                                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {marginPct}%
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Itemized Settlement Card */}
                      {isExpanded && (
                        <tr className="bg-slate-900/90 border-b border-slate-800">
                          <td colSpan={9} className="p-4 sm:p-5">
                            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                <span className="font-bold text-white text-xs flex items-center space-x-2">
                                  <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>
                                    SETTLEMENT BREAKDOWN: {flight.origin_icao} ➔ {flight.destination_icao}
                                  </span>
                                </span>
                                <span className="text-slate-400 text-[10px]">
                                  Recorded via {flight.source === 'airbound_dispatch' ? 'Airbound Dispatch Contract' : 'MSFS Logbook'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                                  <span className="text-slate-500 text-[10px] block">GROSS PAYOUT</span>
                                  <span className="font-bold text-cyan-400 text-sm mt-0.5 block">
                                    ${flight.gross_payout.toLocaleString()}
                                  </span>
                                  {flight.exploration_bonus > 0 && (
                                    <span className="text-[10px] text-purple-400 mt-0.5 block">
                                      Includes +${flight.exploration_bonus} Discovery
                                    </span>
                                  )}
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                                  <span className="text-slate-500 text-[10px] block">FUEL EXPENSE</span>
                                  <span className="font-bold text-amber-400 text-sm mt-0.5 block">
                                    -${flight.fuel_cost.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    {flight.fuel_gallons} gal burned
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                                  <span className="text-slate-500 text-[10px] block">LANDING FEE</span>
                                  <span className="font-bold text-rose-400 text-sm mt-0.5 block">
                                    -${flight.landing_fee.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    Arrival airfield fee
                                  </span>
                                </div>

                                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60">
                                  <span className="text-emerald-400 text-[10px] block font-semibold">NET CASH FLOW</span>
                                  <span className="font-extrabold text-emerald-400 text-base mt-0.5 block">
                                    +${flight.net_payout.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] text-emerald-300/80 mt-0.5 block">
                                    Credited to bank
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
  );
}

export default CashFlowView;
