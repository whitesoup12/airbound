import React, { useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Fuel,
  Sparkles,
  Plane,
  MapPin,
  Percent,
  Warehouse,
  Coins,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Package,
  Users,
  Gauge,
  Key,
  Compass
} from 'lucide-react';

export function CashFlowView({
  pilot,
  allAirports = [],
  onSwitchToDispatch,
  onSwitchToFleet
}) {
  const flightLog = useMemo(() => pilot?.flight_log || [], [pilot?.flight_log]);
  const fleet = useMemo(() => pilot?.fleet || [], [pilot?.fleet]);
  const balance = pilot?.balance || 0;
  const STARTING_BALANCE = 15000;

  // Rented aircraft in fleet
  const rentedPlanes = useMemo(
    () => fleet.filter((p) => p.is_rental && !p.is_loaner),
    [fleet]
  );

  // Aggregate comprehensive financial metrics
  const financialData = useMemo(() => {
    let grossRevenue = 0;
    let netPayout = 0;
    let fuelCost = 0;
    let fuelGallons = 0;
    let landingFees = 0;
    let rentalFees = 0;
    let explorationBonuses = 0;
    let dispatchCount = 0;
    let totalDistanceNm = 0;
    let totalCargoLbs = 0;
    let totalPax = 0;

    // Per-aircraft performance tracker
    const aircraftMap = new Map();

    for (const f of flightLog) {
      const gross = f.gross_payout || f.payout || 0;
      const net = f.net_payout || f.payout || 0;
      const fuel = f.fuel_cost || 0;
      const gal = f.fuel_gallons || 0;
      const landing = f.landing_fee || 0;
      const rental = f.rental_fee || 0;
      const bonus = f.exploration_bonus || 0;
      const dist = f.distance_nm || 0;
      const cargo = f.cargo_lbs || 0;
      const pax = f.pax_count || 0;

      grossRevenue += gross;
      netPayout += net;
      fuelCost += fuel;
      fuelGallons += gal;
      landingFees += landing;
      rentalFees += rental;
      explorationBonuses += bonus;
      totalDistanceNm += dist;
      totalCargoLbs += cargo;
      totalPax += pax;

      const isDispatch = f.source === 'airbound_dispatch' || fuel > 0 || landing > 0 || gross > 0;
      if (isDispatch) {
        dispatchCount++;

        // Track per aircraft model
        const planeName = f.aircraft_name || 'Cessna 172 Skyhawk';
        if (!aircraftMap.has(planeName)) {
          const matchingFleet = fleet.find(
            (p) => p.name === planeName || (p.model_id && planeName.toLowerCase().includes(p.model_id.toLowerCase()))
          );

          aircraftMap.set(planeName, {
            name: planeName,
            tailNumber: matchingFleet?.tail_number || 'N172AB',
            isRental: Boolean(matchingFleet?.is_rental || rental > 0),
            rentalRate: matchingFleet?.rental_price_per_flight || (rental > 0 ? rental : 0),
            flights: 0,
            gross: 0,
            fuelCost: 0,
            fuelGal: 0,
            landingFees: 0,
            rentalFees: 0,
            distanceNm: 0,
            cargoLbs: 0,
            paxCount: 0
          });
        }

        const planeStats = aircraftMap.get(planeName);
        planeStats.flights++;
        planeStats.gross += gross;
        planeStats.fuelCost += fuel;
        planeStats.fuelGal += gal;
        planeStats.landingFees += landing;
        planeStats.rentalFees += rental;
        planeStats.distanceNm += dist;
        planeStats.cargoLbs += cargo;
        planeStats.paxCount += pax;
      }
    }

    // Fallback: If rental fee was paid at lease time but not logged on flight
    if (rentalFees === 0 && rentedPlanes.length > 0) {
      rentalFees = rentedPlanes.reduce((sum, p) => sum + (p.rental_price_per_flight || 0), 0);
    }

    const totalOperatingExpenses = fuelCost + landingFees + rentalFees;
    const trueNetProfit = grossRevenue - totalOperatingExpenses;
    const profitMargin = grossRevenue > 0 ? (trueNetProfit / grossRevenue) * 100 : 100;
    const baseContractRevenue = Math.max(0, grossRevenue - explorationBonuses);
    const careerNetGain = balance - STARTING_BALANCE;

    const avgFuelPerGal = fuelGallons > 0 ? fuelCost / fuelGallons : 6.0;
    const avgFuelPerNm = totalDistanceNm > 0 ? fuelCost / totalDistanceNm : 0;
    const revenuePerNm = totalDistanceNm > 0 ? grossRevenue / totalDistanceNm : 0;
    const costPerNm = totalDistanceNm > 0 ? totalOperatingExpenses / totalDistanceNm : 0;
    const netPerNm = totalDistanceNm > 0 ? trueNetProfit / totalDistanceNm : 0;
    const fuelMultiplier = fuelCost > 0 ? grossRevenue / fuelCost : 0;

    // Aircraft performance list
    const aircraftList = Array.from(aircraftMap.values()).map((ac) => {
      const expenses = ac.fuelCost + ac.landingFees + ac.rentalFees;
      const net = ac.gross - expenses;
      const margin = ac.gross > 0 ? (net / ac.gross) * 100 : 100;
      return {
        ...ac,
        totalExpenses: expenses,
        netProfit: net,
        margin
      };
    });

    return {
      grossRevenue,
      baseContractRevenue,
      explorationBonuses,
      fuelCost,
      fuelGallons,
      landingFees,
      rentalFees,
      totalOperatingExpenses,
      trueNetProfit,
      profitMargin,
      dispatchCount,
      totalDistanceNm,
      totalCargoLbs,
      totalPax,
      careerNetGain,
      avgFuelPerGal,
      avgFuelPerNm,
      revenuePerNm,
      costPerNm,
      netPerNm,
      fuelMultiplier,
      aircraftList
    };
  }, [flightLog, fleet, balance, rentedPlanes]);

  // Income category shares
  const baseRevenueShare = financialData.grossRevenue > 0
    ? (financialData.baseContractRevenue / financialData.grossRevenue) * 100
    : 100;
  const explorationShare = financialData.grossRevenue > 0
    ? (financialData.explorationBonuses / financialData.grossRevenue) * 100
    : 0;

  // Expense category shares
  const rentalExpenseShare = financialData.totalOperatingExpenses > 0
    ? (financialData.rentalFees / financialData.totalOperatingExpenses) * 100
    : 0;
  const landingExpenseShare = financialData.totalOperatingExpenses > 0
    ? (financialData.landingFees / financialData.totalOperatingExpenses) * 100
    : 0;
  const fuelExpenseShare = financialData.totalOperatingExpenses > 0
    ? (financialData.fuelCost / financialData.totalOperatingExpenses) * 100
    : 0;

  // Macro retention bar percentages
  const netRetainedPct = financialData.grossRevenue > 0
    ? (financialData.trueNetProfit / financialData.grossRevenue) * 100
    : 100;
  const rentalGrossPct = financialData.grossRevenue > 0
    ? (financialData.rentalFees / financialData.grossRevenue) * 100
    : 0;
  const landingGrossPct = financialData.grossRevenue > 0
    ? (financialData.landingFees / financialData.grossRevenue) * 100
    : 0;
  const fuelGrossPct = financialData.grossRevenue > 0
    ? (financialData.fuelCost / financialData.grossRevenue) * 100
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
                <span>CASH FLOW & CATEGORY ECONOMICS</span>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/50">
                  MACRO ACCOUNTING
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Comprehensive breakdown of income sources, operating cost categories, and airframe profitability.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {onSwitchToDispatch && (
            <button
              type="button"
              onClick={onSwitchToDispatch}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Dispatch Board</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}
          {onSwitchToFleet && (
            <button
              type="button"
              onClick={onSwitchToFleet}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Warehouse className="w-3.5 h-3.5 text-amber-400" />
              <span>Fleet Hangar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 font-mono text-xs">
        {/* Card 1: Money in Bank */}
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
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 block tracking-tight">
              ${balance.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Liquid capital available
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Seed: $15,000</span>
            <span className="text-emerald-300 font-bold">
              {financialData.careerNetGain >= 0 ? `+$${financialData.careerNetGain.toLocaleString()}` : `-$${Math.abs(financialData.careerNetGain).toLocaleString()}`} Net
            </span>
          </div>
        </div>

        {/* Card 2: Total Gross Income */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-cyan-800/60 shadow-lg shadow-cyan-950/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              TOTAL GROSS INCOME
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-cyan-400 block tracking-tight">
              ${financialData.grossRevenue.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Contract & bonus revenue
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">{financialData.dispatchCount} Missions</span>
            <span className="text-cyan-300 font-bold">
              Avg ${Math.round(financialData.grossRevenue / Math.max(1, financialData.dispatchCount)).toLocaleString()}/flt
            </span>
          </div>
        </div>

        {/* Card 3: Total Operating Expenses */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-rose-800/60 shadow-lg shadow-rose-950/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              TOTAL EXPENSES PAID
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-400 block tracking-tight">
              -${financialData.totalOperatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Rentals, fuel & landing fees
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">3 Cost Categories</span>
            <span className="text-rose-300 font-bold">
              Avg -${(financialData.totalOperatingExpenses / Math.max(1, financialData.dispatchCount)).toFixed(2)}/flt
            </span>
          </div>
        </div>

        {/* Card 4: Net Operating Profit */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-emerald-800/60 shadow-lg shadow-emerald-950/20 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              NET OPERATING PROFIT
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 block tracking-tight">
              +${financialData.trueNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Retained career earnings
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Margin</span>
            <span className="text-emerald-400 font-bold">
              {financialData.profitMargin.toFixed(1)}% Operating Margin
            </span>
          </div>
        </div>

        {/* Card 5: Exploration Bonuses */}
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
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-300 block tracking-tight">
              +${financialData.explorationBonuses.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              Discovery airfield rewards
            </span>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Unvisited Fields</span>
            <span className="text-purple-300 font-bold">+$500 / field</span>
          </div>
        </div>
      </div>

      {/* 3. Revenue Retention & Macro Economics Bar */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <Percent className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-200 font-bold text-sm tracking-wide">
              MACRO CASH RETENTION & EXPENSE ALLOCATION
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400">
              Net Career Profit:{' '}
              <strong className="text-emerald-400 font-bold text-sm">
                ${financialData.trueNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold">
              {financialData.profitMargin.toFixed(1)}% Retained
            </span>
          </div>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${Math.max(netRetainedPct, 0)}%` }}
              title={`Net Profit Retained: ${netRetainedPct.toFixed(1)}%`}
            />
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.max(rentalGrossPct, 0)}%` }}
              title={`Aircraft Rentals: ${rentalGrossPct.toFixed(1)}%`}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${Math.max(landingGrossPct, 0)}%` }}
              title={`Landing Fees: ${landingGrossPct.toFixed(1)}%`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.max(fuelGrossPct, 0)}%` }}
              title={`Fuel Cost: ${fuelGrossPct.toFixed(1)}%`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
              <span>
                Net Profit: <strong className="text-emerald-300">${financialData.trueNetProfit.toFixed(2)}</strong> ({netRetainedPct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
              <span>
                Aircraft Rentals: <strong className="text-indigo-300">${financialData.rentalFees.toFixed(2)}</strong> ({rentalGrossPct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              <span>
                Landing Fees: <strong className="text-rose-300">${financialData.landingFees.toFixed(2)}</strong> ({landingGrossPct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              <span>
                Fuel Expenses: <strong className="text-amber-300">${financialData.fuelCost.toFixed(2)}</strong> ({fuelGrossPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Side-by-Side Category Breakdown: Income vs Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* LEFT COLUMN: INCOME BY CATEGORY */}
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 bg-slate-900/40 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                  INCOME BY CATEGORY
                </h2>
                <p className="text-[11px] text-slate-400">Where your earnings came from</p>
              </div>
            </div>
            <span className="text-cyan-400 font-extrabold text-base">
              ${financialData.grossRevenue.toLocaleString()}
            </span>
          </div>

          <div className="space-y-4">
            {/* Category 1: Base Dispatch Revenue */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">Base Dispatch Contracts</span>
                    <span className="text-[10px] text-slate-500">Freight & Passenger Delivery Missions</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-cyan-300 text-sm block">
                    ${financialData.baseContractRevenue.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">{baseRevenueShare.toFixed(1)}% of total</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${baseRevenueShare}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  📦 {financialData.totalCargoLbs.toLocaleString()} lbs cargo hauled
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  👥 {financialData.totalPax} passenger{financialData.totalPax === 1 ? '' : 's'} flown
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  ✈️ {financialData.dispatchCount} completed runs
                </span>
              </div>
            </div>

            {/* Category 2: Exploration & Discovery Bonuses */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">Exploration & Discovery Bonuses</span>
                    <span className="text-[10px] text-slate-500">Featured unvisited destination incentive payouts</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-purple-300 text-sm block">
                    +${financialData.explorationBonuses.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">{explorationShare.toFixed(1)}% of total</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${explorationShare}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-purple-950/50 border border-purple-800/50 text-purple-300">
                  ⭐ +$500 per unvisited destination
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  🌍 {pilot?.visited_airports?.length || 1} airfields explored
                </span>
              </div>
            </div>

            {/* Income Performance Highlights */}
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/80 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">AVERAGE PAYOUT PER RUN</span>
                <span className="text-white font-bold text-sm mt-0.5 block">
                  ${Math.round(financialData.grossRevenue / Math.max(1, financialData.dispatchCount)).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">REVENUE GENERATED PER NM</span>
                <span className="text-cyan-400 font-bold text-sm mt-0.5 block">
                  ${financialData.revenuePerNm.toFixed(2)} / NM
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EXPENSES BY CATEGORY */}
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 bg-slate-900/40 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                  EXPENSES BY CATEGORY
                </h2>
                <p className="text-[11px] text-slate-400">Where your money was spent</p>
              </div>
            </div>
            <span className="text-rose-400 font-extrabold text-base">
              -${financialData.totalOperatingExpenses.toFixed(2)}
            </span>
          </div>

          <div className="space-y-4">
            {/* Expense 1: Aircraft Rental Leases */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">Aircraft Rental Leases</span>
                    <span className="text-[10px] text-slate-500">Per-flight airframe rental deductions</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-indigo-300 text-sm block">
                    -${financialData.rentalFees.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">{rentalExpenseShare.toFixed(1)}% of expenses</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${rentalExpenseShare}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-800/50 text-indigo-300">
                  🔑 {rentedPlanes.length > 0 ? rentedPlanes[0].name.replace(' (Rental)', '') : 'Fleet Leases'} (${rentedPlanes.length > 0 ? rentedPlanes[0].rental_price_per_flight : 950}/flight)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  Owned planes: $0.00 lease
                </span>
              </div>
            </div>

            {/* Expense 2: Airport Landing Fees */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">Airport Runway & Landing Fees</span>
                    <span className="text-[10px] text-slate-500">Arrival runway maintenance and handling</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-rose-300 text-sm block">
                    -${financialData.landingFees.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">{landingExpenseShare.toFixed(1)}% of expenses</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${landingExpenseShare}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  🏢 Hubs: $350
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  🛫 Regional: $120
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  🛬 Small: $35
                </span>
              </div>
            </div>

            {/* Expense 3: Aviation Fuel Burn */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
                    <Fuel className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">Aviation Fuel (100LL & Jet-A)</span>
                    <span className="text-[10px] text-slate-500">Operating fuel burned during transit</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-amber-300 text-sm block">
                    -${financialData.fuelCost.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">{fuelExpenseShare.toFixed(1)}% of expenses</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${fuelExpenseShare}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  ⛽ {financialData.fuelGallons.toFixed(1)} gal total
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  💲 ${financialData.avgFuelPerGal.toFixed(2)} / gal avg
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  📏 ${financialData.avgFuelPerNm.toFixed(2)} / NM
                </span>
              </div>
            </div>

            {/* Operating Expense Highlights */}
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/80 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">AVERAGE COST PER RUN</span>
                <span className="text-rose-300 font-bold text-sm mt-0.5 block">
                  -${(financialData.totalOperatingExpenses / Math.max(1, financialData.dispatchCount)).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">OPERATING COST PER NM</span>
                <span className="text-rose-400 font-bold text-sm mt-0.5 block">
                  -${financialData.costPerNm.toFixed(2)} / NM
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Airframe & Fleet Economics Breakdown */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 bg-slate-900/40 space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <Warehouse className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                AIRFRAME PROFITABILITY & FLEET COMPARISON
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Financial performance, rental overhead, and net margin compared by aircraft model.
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {financialData.aircraftList.length} Aircraft Model{financialData.aircraftList.length === 1 ? '' : 's'} Flown
          </span>
        </div>

        {/* Aircraft Comparison Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {financialData.aircraftList.map((ac) => {
            return (
              <div
                key={ac.name}
                className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 shadow-md"
              >
                {/* Aircraft Header */}
                <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Plane className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-white text-sm">{ac.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Tail: <strong className="text-slate-200">{ac.tailNumber}</strong> • {ac.flights} flight{ac.flights === 1 ? '' : 's'} ({Math.round(ac.distanceNm)} NM)
                    </span>
                  </div>

                  {ac.isRental ? (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-bold text-[10px]">
                      RENTAL (${ac.rentalRate}/flt)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold text-[10px]">
                      OWNED AIRFRAME
                    </span>
                  )}
                </div>

                {/* Arithmetic Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[9px] uppercase">GROSS REVENUE</span>
                    <span className="font-bold text-cyan-400 text-xs mt-0.5 block">
                      ${ac.gross.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[9px] uppercase">RENTAL LEASE</span>
                    <span className="font-bold text-indigo-400 text-xs mt-0.5 block">
                      {ac.rentalFees > 0 ? `-$${ac.rentalFees.toLocaleString()}` : '$0.00'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-slate-500 block text-[9px] uppercase">FUEL & FEES</span>
                    <span className="font-bold text-rose-400 text-xs mt-0.5 block">
                      -${(ac.fuelCost + ac.landingFees).toFixed(2)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60">
                    <span className="text-emerald-400 block text-[9px] uppercase font-semibold">NET PROFIT</span>
                    <span className="font-extrabold text-emerald-300 text-xs mt-0.5 block">
                      +${ac.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Sub-metrics */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-800/60">
                  <span>
                    Operating Margin:{' '}
                    <strong className={ac.margin >= 80 ? 'text-emerald-400' : 'text-cyan-400'}>
                      {ac.margin.toFixed(1)}%
                    </strong>
                  </span>
                  <span>
                    Fuel Consumed: <strong className="text-amber-400">{ac.fuelGal.toFixed(1)} gal</strong>
                  </span>
                  <span>
                    Avg Net:{' '}
                    <strong className="text-slate-200">
                      ${Math.round(ac.netProfit / Math.max(1, ac.flights)).toLocaleString()}/flight
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Career Efficiency & ROI Multipliers (Summary Tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase">GROSS / NAUTICAL MILE</span>
          <span className="text-lg font-bold text-white mt-1 block">
            ${financialData.revenuePerNm.toFixed(2)} / NM
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Airborne revenue rate</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase">COST / NAUTICAL MILE</span>
          <span className="text-lg font-bold text-rose-400 mt-1 block">
            -${financialData.costPerNm.toFixed(2)} / NM
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Operating expense rate</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase">NET PROFIT / NM</span>
          <span className="text-lg font-bold text-emerald-400 mt-1 block">
            +${financialData.netPerNm.toFixed(2)} / NM
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">True profit per air mile</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase">FUEL REVENUE MULTIPLIER</span>
          <span className="text-lg font-bold text-amber-400 mt-1 block">
            {financialData.fuelMultiplier.toFixed(1)}x ROI
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">$ earned per $1 fuel burned</span>
        </div>
      </div>
    </div>
  );
}

export default CashFlowView;
