import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Warehouse,
  Award,
  DollarSign,
  Compass,
  Radio,
  FileCheck,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Fuel,
  Plane,
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  Zap,
  Info
} from 'lucide-react';
import { PILOT_RANKS, LANDING_CLASS_CONFIGS } from '../../utils/xpUtils.js';

export function GuideView({ onNavigateTab, pilot }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All Topics', icon: BookOpen },
    { id: 'rent-to-own', label: 'Fleet & Renting', icon: Warehouse },
    { id: 'xp-ranks', label: 'XP & Career Ranks', icon: Award },
    { id: 'economy', label: 'Economy & Finances', icon: DollarSign },
    { id: 'flight-modes', label: 'Flight Modes & Dispatch', icon: Compass },
    { id: 'simconnect', label: 'MSFS Sync & Telemetry', icon: Radio },
    { id: 'logbook', label: 'Logbook & Import', icon: FileCheck }
  ];

  const guideSections = [
    {
      id: 'rent-to-own',
      category: 'rent-to-own',
      title: 'Rent-to-Own Fleet Equity',
      badge: 'Save Money',
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
      icon: Warehouse,
      summary: 'Every dollar you spend renting an aircraft works directly towards buying it permanently.',
      details: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            You don’t have to grind hundreds of thousands of dollars before flying your favorite aircraft.
            Airbound features a built-in <strong className="text-amber-300 font-semibold">Rent-to-Own Equity Program</strong> designed to let you build wealth as you fly.
          </p>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>The 75% Equity Rule</span>
            </div>
            <p className="text-slate-300 font-sans text-xs leading-relaxed">
              Whenever you rent an aircraft for a commercial contract flight, exactly <span className="text-emerald-400 font-bold">75% of the rental fee</span> is automatically deposited into your permanent <span className="text-white font-semibold">Equity Bank</span> for that specific aircraft model.
            </p>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <span className="text-slate-500 block text-[11px] mb-1">Buyout Price Formula:</span>
              <code className="text-cyan-300 font-bold text-sm block">
                Purchase Price = Catalog Price - Accumulated Equity
              </code>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-white flex items-center space-x-1.5">
                <span className="text-emerald-400 font-bold">1.</span>
                <span>Reduced Purchase Cost</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                As you complete flights in a rented plane, its purchase price decreases continuously in the Fleet Dealership. You can buy it out at any discounted price whenever your cash balance allows.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-white flex items-center space-x-1.5">
                <span className="text-cyan-400 font-bold">2.</span>
                <span>100% Free Claim</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                If your accumulated rental equity reaches 100% of the catalog price, the buyout price drops to <span className="text-emerald-300 font-bold">$0</span>. You can claim full title and ownership with zero remaining cost!
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-200 text-xs flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>Note on Free Flights:</strong> Free Flight sessions do not incur rental fees, meaning they do not deduct rental costs from your balance and do not accumulate rental equity.
            </span>
          </div>

          {onNavigateTab && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('fleet')}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <span>View Fleet & Dealership</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'xp-ranks',
      category: 'xp-ranks',
      title: 'XP Calculation & Career Ranks',
      badge: 'Progression',
      badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
      icon: Award,
      summary: 'Experience points (XP) scale with flight distance, landing smoothness, new airports, and runway challenges.',
      details: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Your Pilot Career reflects your aeronautical skill and dedication. Every completed flight evaluates five itemized factors to award career XP:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">DISTANCE</span>
              <span className="text-cyan-300 font-bold text-base block mt-0.5">1 XP / NM</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">1 point per nautical mile flown.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">SUCCESSFUL ARRIVAL</span>
              <span className="text-emerald-300 font-bold text-base block mt-0.5">+50 XP</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">Full flight completion & engine shutdown.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">NEW AIRFIELD</span>
              <span className="text-purple-300 font-bold text-base block mt-0.5">+100 XP</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">First-time exploration bonus.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">SHORT RUNWAY</span>
              <span className="text-amber-300 font-bold text-base block mt-0.5">+75 XP</span>
              <p className="text-slate-400 font-sans text-[11px] mt-1">Airfield runway &lt; 4,000 feet.</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white text-xs uppercase tracking-wider font-mono flex items-center space-x-1.5">
              <span>Touchdown Vertical Speed (FPM) Rating</span>
            </h4>
            <p className="text-xs text-slate-400">
              Touchdown ratings adapt dynamically to your aircraft category. A greaser in a Boeing 747 has different physical tolerances than a Cessna 172:
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/50">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    <th className="p-2.5 font-semibold">Rating</th>
                    <th className="p-2.5 font-semibold">Bonus XP</th>
                    <th className="p-2.5 font-semibold">Light GA</th>
                    <th className="p-2.5 font-semibold">Twin / Turboprop</th>
                    <th className="p-2.5 font-semibold">Airliner / Jet</th>
                    <th className="p-2.5 font-semibold">Heavy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="p-2.5 text-emerald-400 font-bold">🧈 Butter</td>
                    <td className="p-2.5 text-emerald-300 font-semibold">+100 XP</td>
                    <td className="p-2.5 text-slate-300">≤ 90 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 135 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 180 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 240 fpm</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-400 font-bold">✈️ Clean / Good</td>
                    <td className="p-2.5 text-cyan-300 font-semibold">+50 XP</td>
                    <td className="p-2.5 text-slate-300">≤ 200 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 250 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 300 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 360 fpm</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-amber-400 font-bold">⚡ Firm</td>
                    <td className="p-2.5 text-slate-400">0 XP</td>
                    <td className="p-2.5 text-slate-300">≤ 350 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 400 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 450 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 500 fpm</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-orange-400 font-bold">⚠️ Hard</td>
                    <td className="p-2.5 text-orange-300 font-semibold">-50 XP</td>
                    <td className="p-2.5 text-slate-300">≤ 500 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 550 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 600 fpm</td>
                    <td className="p-2.5 text-slate-300">≤ 650 fpm</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-rose-400 font-bold">💥 Severe</td>
                    <td className="p-2.5 text-rose-300 font-semibold">-100 XP</td>
                    <td className="p-2.5 text-slate-300">&gt; 500 fpm</td>
                    <td className="p-2.5 text-slate-300">&gt; 550 fpm</td>
                    <td className="p-2.5 text-slate-300">&gt; 600 fpm</td>
                    <td className="p-2.5 text-slate-300">&gt; 650 fpm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white text-xs uppercase tracking-wider font-mono flex items-center space-x-1.5">
              <span>Seniority Payout Multipliers</span>
            </h4>
            <p className="text-xs text-slate-400">
              Climbing pilot ranks rewards you with permanent commercial payout bonuses:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
              {PILOT_RANKS.slice(0, 10).map((r) => (
                <div key={r.level} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 block">LEVEL {r.level}</span>
                  <span className="text-white font-bold block truncate text-[11px]">{r.title}</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">+{r.bonusPercent}% Pay</span>
                </div>
              ))}
            </div>
          </div>

          {onNavigateTab && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('progression')}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <span>View Career Progression Tab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'economy',
      category: 'economy',
      title: 'Economy, Fuel & Operating Expenses',
      badge: 'Finances',
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
      icon: DollarSign,
      summary: 'Understand how gross contract earnings, fuel prices, and runway landing fees produce your net profit.',
      details: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Real aviation has operational costs, and Airbound models a transparent economic ledger upon every arrival:
          </p>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold uppercase tracking-wider">
              <DollarSign className="w-4 h-4" />
              <span>Net Profit Calculation</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              <span className="text-slate-500 block text-[11px] mb-1">Settlement Ledger Formula:</span>
              <code className="text-emerald-300 font-bold text-sm block">
                Net Profit = Gross Contract Payout - Fuel Expense - Landing Fee
              </code>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Fuel Rates Card */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center space-x-2 text-cyan-400 font-mono font-bold">
                <Fuel className="w-4 h-4" />
                <span>Fuel Burn & Market Rates</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Fuel is calculated based on your aircraft’s consumption rate (Gallons Per Hour) and total flight time (minimum 5 minutes for taxi and climb):
              </p>
              <ul className="space-y-1.5 font-mono text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-1">
                  <span>AvGas 100LL (Pistons):</span>
                  <span className="text-cyan-300 font-bold">$6.40 / gal</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Jet-A (Turboprops &amp; Jets):</span>
                  <span className="text-cyan-300 font-bold">$5.60 / gal</span>
                </li>
              </ul>
            </div>

            {/* Landing Fees Card */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center space-x-2 text-amber-400 font-mono font-bold">
                <Plane className="w-4 h-4" />
                <span>Destination Landing &amp; Ramp Fees</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Landing fees are determined by the longest runway length at the destination airfield:
              </p>
              <ul className="space-y-1.5 font-mono text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Major Hub (≥ 9,500 ft):</span>
                  <span className="text-amber-300 font-bold">$350</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Regional Commercial (5,000–9,499 ft):</span>
                  <span className="text-amber-300 font-bold">$120</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Untowered GA (&lt; 5,000 ft):</span>
                  <span className="text-emerald-300 font-bold">$35</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
            <span className="font-semibold text-white block">Aircraft Depreciation &amp; Resale:</span>
            <p className="text-slate-400 leading-relaxed">
              When selling a purchased aircraft from your fleet, its value depreciates based on initial dealer commission (15%) plus 0.5% per flight hour logged, with a protected residual floor value of 20%.
            </p>
          </div>

          {onNavigateTab && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('cash-flow')}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <span>View Cash Flow &amp; Financial Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'flight-modes',
      category: 'flight-modes',
      title: 'Commercial Dispatch vs Free Flight',
      badge: 'Operations',
      badgeColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
      icon: Compass,
      summary: 'Choose between structured commercial contracts or unrestricted open exploration with flexible fee rules.',
      details: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Airbound supports two primary ways to fly:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold font-mono">
                <Compass className="w-4 h-4" />
                <span>Commercial Dispatch Jobs</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Legitimate airline and cargo missions automatically generated for verified airports surrounding your current location.
              </p>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                <li>Strict origin and destination airports</li>
                <li>Financial contract payouts with cargo/passenger bonuses</li>
                <li>Automatic fuel and landing fee deductions</li>
                <li>Accumulates Rent-to-Own equity on rentals</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-purple-400 font-bold font-mono">
                <Plane className="w-4 h-4" />
                <span>Free Flight Exploration</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Fly wherever you please without an active contract. Fly cross-country, practice pattern landings, or tour scenery.
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <span className="text-amber-300 font-bold font-mono block">Standard Mode:</span>
                  <span className="text-slate-400">Deducts fuel burned &amp; landing fee realistically upon touchdown.</span>
                </div>
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <span className="text-emerald-300 font-bold font-mono block">Casual Mode:</span>
                  <span className="text-slate-400">All fees waived ($0 expenses) for worry-free practice.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Both Dispatch jobs and Free Flight sessions record official flight time, touchdown FPM quality, and career XP in your logbook!
            </span>
          </div>

          {onNavigateTab && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('dispatch')}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <span>Go to Dispatch View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'simconnect',
      category: 'simconnect',
      title: 'Microsoft Flight Simulator Auto-Connect',
      badge: 'SimConnect Bridge',
      badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-700/60',
      icon: Radio,
      summary: 'Airbound connects automatically to Microsoft Flight Simulator 2024 and 2020 via native SimConnect.',
      details: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            When using the Airbound Desktop application, telemetry connection is 100% plug-and-play. You do not need to install background servers, configure FSUIPC, or edit configuration files.
          </p>

          <div className="space-y-2">
            <h4 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
              Connection Status Indicators
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
                <div className="flex items-center space-x-2 font-bold mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>MSFS 2024 / LINKED</span>
                </div>
                <p className="text-slate-300 font-sans text-[11px]">
                  Actively receiving live telemetry (altitude, speed, coordinates, gear, fuel) from your aircraft.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300">
                <div className="flex items-center space-x-2 font-bold mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>SEARCHING / WAITING</span>
                </div>
                <p className="text-slate-300 font-sans text-[11px]">
                  Built-in SimConnect bridge is scanning for MSFS. Start the simulator and load into a flight to link.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300">
                <div className="flex items-center space-x-2 font-bold mb-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>CONNECTOR OFFLINE</span>
                </div>
                <p className="text-slate-300 font-sans text-[11px]">
                  Simulator bridge process is stopped or running in external browser mode.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white text-xs uppercase tracking-wider font-mono">
              Automated Flight Phase Detection
            </h4>
            <p className="text-xs text-slate-400">
              The telemetry engine automatically tracks your flight through every phase without requiring manual button clicks:
            </p>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
              {['STANDBY', 'TAXI_OUT', 'TAKEOFF', 'EN_ROUTE', 'APPROACH', 'LANDED', 'COMPLETED'].map((phase, idx, arr) => (
                <React.Fragment key={phase}>
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200">
                    {phase}
                  </span>
                  {idx < arr.length - 1 && <span className="text-slate-600">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'logbook',
      category: 'logbook',
      title: 'Logbook Sync & MSFS Deduplication',
      badge: 'Data Integrity',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      icon: FileCheck,
      summary: 'Safe, non-destructive import of your official Microsoft Flight Simulator flight history.',
      details: (
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            You can import your official Microsoft Flight Simulator logbook directly into Airbound from the <strong className="text-white">Options</strong> tab.
          </p>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Smart Merge &amp; Route Window Deduplication</span>
            </div>
            <ul className="space-y-2 text-slate-300 font-sans text-xs">
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold mt-0.5">•</span>
                <span>
                  <strong>Non-Destructive Merge:</strong> Importing never wipes or overrides your existing Airbound career flights, earnings, or aircraft fleet.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold mt-0.5">•</span>
                <span>
                  <strong>Smart 3-Hour Deduplication:</strong> Because Airbound dispatch jobs complete a few minutes before MSFS finishes recording its internal session, Airbound matches routes within a ±3 hour departure window to prevent duplicate records.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold mt-0.5">•</span>
                <span>
                  <strong>Aborted Flight Filtering:</strong> Flights with 0 nautical miles or lasting under 2–3 minutes are automatically omitted so your logbook remains clean.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold mt-0.5">•</span>
                <span>
                  <strong>Verified MSFS Airfields:</strong> All contract dispatch jobs only route between verified airfields present in Microsoft Flight Simulator.
                </span>
              </li>
            </ul>
          </div>

          {onNavigateTab && (
            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => onNavigateTab('options')}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <span>Go to Options &amp; Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('logbook')}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-mono font-semibold transition cursor-pointer"
              >
                <span>View Flight Logbook</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )
    }
  ];

  // Filtering based on search query and category
  const filteredSections = useMemo(() => {
    return guideSections.filter((section) => {
      const matchesCategory = selectedCategory === 'all' || section.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        section.title.toLowerCase().includes(q) ||
        section.summary.toLowerCase().includes(q) ||
        section.id.toLowerCase().includes(q)
      );
    });
  }, [guideSections, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide font-mono">
                PILOT HANDBOOK &amp; GUIDE
              </h1>
              <p className="text-xs text-slate-400">
                Quick reference guide to game mechanics, flight calculations, and operating procedures.
              </p>
            </div>
          </div>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mechanics, XP, fees..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 font-mono transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-mono"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs / Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-mono whitespace-nowrap transition cursor-pointer border ${
                isActive
                  ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 font-bold shadow-md shadow-cyan-950/40'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Guide Content Cards */}
      {filteredSections.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
          <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-slate-300 font-medium">No guide topics matched &quot;{searchQuery}&quot;</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="text-xs text-cyan-400 hover:underline font-mono"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                id={section.id}
                className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-xl space-y-4 hover:border-slate-700/80 transition"
              >
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-3.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-cyan-400 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white font-mono flex items-center space-x-2">
                        <span>{section.title}</span>
                      </h2>
                      <p className="text-xs text-slate-400">{section.summary}</p>
                    </div>
                  </div>

                  {section.badge && (
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full border font-mono font-bold self-start sm:self-center shrink-0 ${
                        section.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {section.badge}
                    </span>
                  )}
                </div>

                {/* Section Details Body */}
                <div className="pt-1">{section.details}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GuideView;
