import Aircraft from '../models/Aircraft.js';
import Pilot from '../models/Pilot.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';
import { calculateAircraftResaleValue } from '../services/economyService.js';
import { flightStateMachine, FLIGHT_PHASES } from '../services/stateMachine.js';

/**
 * Returns complete MSFS 2024 aircraft catalog
 */
export async function getCatalog(req, res) {
  try {
    const pilot = await Pilot.findOne().select('rent_to_own_equity balance').lean();
    const equityMap = pilot?.rent_to_own_equity || {};
    const catalog = await Aircraft.find().sort({ purchase_price: 1 }).lean();

    const enrichedCatalog = catalog.map((c) => {
      const equity = Number(equityMap[c.model_id]) || 0;
      const effectivePurchasePrice = Math.max(0, c.purchase_price - equity);
      const equityPercent = Math.min(100, Math.round((equity / c.purchase_price) * 100));
      const rentalEquityPerFlight = Math.round(c.rental_price_per_flight * 0.75);
      return {
        ...c,
        accumulated_equity: equity,
        effective_purchase_price: effectivePurchasePrice,
        equity_percent: equityPercent,
        rental_equity_per_flight: rentalEquityPerFlight
      };
    });

    res.json({
      catalog: enrichedCatalog,
      rentToOwnEquity: equityMap
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Returns pilot's owned and rented fleet alongside active aircraft and depreciation details
 */
export async function getHangar(req, res) {
  try {
    let pilot = await Pilot.findOne().select('fleet active_aircraft balance rent_to_own_equity').lean();
    if (!pilot) {
      pilot = await Pilot.create({ callsign: 'James' });
    }

    const catalog = await Aircraft.find().lean();
    const catalogMap = new Map(catalog.map((c) => [c.model_id, c]));
    const equityMap = pilot.rent_to_own_equity || {};

    const enrichedFleet = (pilot.fleet || []).map((plane) => {
      const planeObj = plane.toObject ? plane.toObject() : { ...plane };
      const model = catalogMap.get(plane.model_id);
      if (model) {
        planeObj.category = model.category || planeObj.category;
        planeObj.catalog_purchase_price = model.purchase_price;
        if (!plane.is_rental) {
          const resale = calculateAircraftResaleValue(model.purchase_price, plane.flight_hours || 0);
          planeObj.resale_value = resale.resaleValue;
          planeObj.total_depreciation = resale.totalDepreciation;
          planeObj.depreciation_percent = resale.totalDepreciationPercent;
          planeObj.base_depreciation_percent = resale.baseDepreciationPercent;
          planeObj.hourly_depreciation_percent = resale.hourlyDepreciationPercent;
          planeObj.salvage_floor_reached = resale.salvageFloorReached;
        } else {
          // Rental lease rent-to-own equity details
          const equity = Number(equityMap[plane.model_id]) || Number(plane.accumulated_equity) || 0;
          planeObj.accumulated_equity = equity;
          planeObj.remaining_buyout_price = Math.max(0, model.purchase_price - equity);
          planeObj.equity_percent = Math.min(100, Math.round((equity / model.purchase_price) * 100));
          planeObj.rental_equity_per_flight = Math.round(model.rental_price_per_flight * 0.75);
        }
      }
      return planeObj;
    });

    let activeAircraft = pilot.active_aircraft;
    if (activeAircraft && activeAircraft.model_id) {
      const activeModel = catalogMap.get(activeAircraft.model_id);
      if (activeModel) {
        if (activeAircraft.category !== activeModel.category) {
          activeAircraft.category = activeModel.category;
        }
        if (activeAircraft.is_rental) {
          const equity = Number(equityMap[activeAircraft.model_id]) || Number(activeAircraft.accumulated_equity) || 0;
          activeAircraft.accumulated_equity = equity;
          activeAircraft.remaining_buyout_price = Math.max(0, activeModel.purchase_price - equity);
          activeAircraft.equity_percent = Math.min(100, Math.round((equity / activeModel.purchase_price) * 100));
        }
      }
    }

    res.json({
      fleet: enrichedFleet,
      activeAircraft,
      balance: pilot.balance || 0,
      rentToOwnEquity: equityMap
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Purchase an aircraft from dealership using career balance or rent-to-own buyout
 */
export async function buyAircraft(req, res) {
  try {
    const { modelId, tailNumber } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required to purchase an aircraft.' });
    }

    const model = await Aircraft.findOne({ model_id: modelId.toLowerCase() });
    if (!model) {
      return res.status(404).json({ error: `Aircraft model '${modelId}' not found in catalog.` });
    }

    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = await Pilot.create({ callsign: 'James' });
    }

    const equityMap = pilot.rent_to_own_equity || {};
    const accruedEquity = Number(equityMap[model.model_id]) || 0;
    const effectivePrice = Math.max(0, model.purchase_price - accruedEquity);

    if (pilot.balance < effectivePrice) {
      const shortage = effectivePrice - pilot.balance;
      return res.status(400).json({
        error: `Insufficient funds. Buyout price is $${effectivePrice.toLocaleString()} (after $${accruedEquity.toLocaleString()} rent-to-own credit), but you have $${pilot.balance.toLocaleString()} ($${shortage.toLocaleString()} more needed).`
      });
    }

    // Deduct effective buyout price
    pilot.balance -= effectivePrice;

    // Clear banked equity for this model since it is now owned
    if (pilot.rent_to_own_equity) {
      delete pilot.rent_to_own_equity[model.model_id];
      pilot.markModified('rent_to_own_equity');
    }

    // Check if the pilot already has a rental of this model in their fleet
    const existingRentalIndex = (pilot.fleet || []).findIndex(
      (p) => p.model_id === model.model_id && p.is_rental
    );

    let resolvedPlane;
    if (existingRentalIndex !== -1) {
      // Convert existing rental directly into an owned aircraft!
      const rentalPlane = pilot.fleet[existingRentalIndex];
      rentalPlane.is_rental = false;
      rentalPlane.name = model.name;
      rentalPlane.rental_price_per_flight = 0;
      rentalPlane.rental_flights_paid = 0;
      rentalPlane.accumulated_equity = 0;
      rentalPlane.purchased_at = new Date();
      if (tailNumber && tailNumber.trim()) {
        rentalPlane.tail_number = tailNumber.trim().toUpperCase();
      }
      resolvedPlane = rentalPlane;
    } else {
      // Create new owned aircraft
      const randomSuffix = Math.floor(100 + Math.random() * 899);
      const resolvedTailNumber =
        (tailNumber && tailNumber.trim().toUpperCase()) || `N${randomSuffix}AB`;

      resolvedPlane = {
        aircraft_id: model._id,
        model_id: model.model_id,
        name: model.name,
        tail_number: resolvedTailNumber,
        category: model.category,
        is_rental: false,
        rental_price_per_flight: 0,
        rental_flights_paid: 0,
        accumulated_equity: 0,
        is_loaner: false,
        purchased_at: new Date(),
        flight_hours: 0
      };
      pilot.fleet.push(resolvedPlane);
    }

    // Automatically set as active aircraft
    pilot.active_aircraft = {
      model_id: model.model_id,
      name: model.name,
      tail_number: resolvedPlane.tail_number,
      category: model.category,
      is_rental: false,
      rental_price_per_flight: 0,
      rental_flights_paid: 0,
      accumulated_equity: 0,
      flight_hours: resolvedPlane.flight_hours || 0,
      is_loaner: false,
      cruise_speed_kts: model.cruise_speed_kts,
      max_range_nm: model.max_range_nm,
      max_cargo_lbs: model.max_cargo_lbs,
      max_pax: model.max_pax,
      min_runway_ft: model.min_runway_ft,
      fuel_type: model.fuel_type,
      fuel_burn_gph: model.fuel_burn_gph
    };

    await pilot.save();
    flightStateMachine.setActiveAircraft(pilot.active_aircraft);

    // Regenerate jobs scaled to new aircraft
    try {
      await generateJobsForAirport(pilot.current_icao, { aircraft: pilot.active_aircraft });
    } catch (jobErr) {
      console.warn('[Fleet] Warning: Failed to regenerate jobs for airport after purchase:', jobErr.message);
    }

    const message = accruedEquity > 0
      ? `Successfully purchased ${model.name} (${resolvedPlane.tail_number}) for $${effectivePrice.toLocaleString()}! (Credited $${accruedEquity.toLocaleString()} in rent-to-own equity). Set as active aircraft.`
      : `Successfully purchased ${model.name} (${resolvedPlane.tail_number})! Set as active flight aircraft.`;

    res.json({
      message,
      pilot,
      activeAircraft: pilot.active_aircraft,
      purchasedPlane: resolvedPlane,
      rentToOwnEquity: pilot.rent_to_own_equity || {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Rent an aircraft for a flight (75% of rental fee builds Rent-to-Own purchase equity)
 */
export async function rentAircraft(req, res) {
  try {
    const { modelId } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required to rent an aircraft.' });
    }

    const model = await Aircraft.findOne({ model_id: modelId.toLowerCase() });
    if (!model) {
      return res.status(404).json({ error: `Aircraft model '${modelId}' not found in catalog.` });
    }

    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = await Pilot.create({ callsign: 'James' });
    }

    if (pilot.balance < model.rental_price_per_flight) {
      return res.status(400).json({
        error: `Insufficient funds. Rental fee of $${model.rental_price_per_flight.toLocaleString()} exceeds balance of $${pilot.balance.toLocaleString()}.`
      });
    }

    // Deduct rental fee
    pilot.balance -= model.rental_price_per_flight;

    // Credit rent-to-own equity (75%)
    const equityCredit = Math.round(model.rental_price_per_flight * 0.75);
    if (!pilot.rent_to_own_equity) {
      pilot.rent_to_own_equity = {};
    }
    pilot.rent_to_own_equity[model.model_id] = (Number(pilot.rent_to_own_equity[model.model_id]) || 0) + equityCredit;
    pilot.markModified('rent_to_own_equity');
    const totalEquity = pilot.rent_to_own_equity[model.model_id];

    const rentalTail = `N${Math.floor(100 + Math.random() * 899)}RT`;
    const rentedPlane = {
      aircraft_id: model._id,
      model_id: model.model_id,
      name: `${model.name} (Rental)`,
      tail_number: rentalTail,
      category: model.category,
      is_rental: true,
      rental_price_per_flight: model.rental_price_per_flight,
      rental_flights_paid: 1, // Prepaid for flight 1
      accumulated_equity: totalEquity,
      is_loaner: false,
      purchased_at: new Date(),
      flight_hours: 0
    };

    pilot.fleet.push(rentedPlane);

    pilot.active_aircraft = {
      model_id: model.model_id,
      name: model.name,
      tail_number: rentalTail,
      category: model.category,
      is_rental: true,
      rental_price_per_flight: model.rental_price_per_flight,
      rental_flights_paid: 1, // Prepaid for flight 1
      accumulated_equity: totalEquity,
      is_loaner: false,
      cruise_speed_kts: model.cruise_speed_kts,
      max_range_nm: model.max_range_nm,
      max_cargo_lbs: model.max_cargo_lbs,
      max_pax: model.max_pax,
      min_runway_ft: model.min_runway_ft,
      fuel_type: model.fuel_type,
      fuel_burn_gph: model.fuel_burn_gph
    };

    await pilot.save();
    flightStateMachine.setActiveAircraft(pilot.active_aircraft);

    // Regenerate jobs scaled to new aircraft
    try {
      await generateJobsForAirport(pilot.current_icao, { aircraft: pilot.active_aircraft });
    } catch (jobErr) {
      console.warn('[Fleet] Warning: Failed to regenerate jobs for airport after rental:', jobErr.message);
    }

    res.json({
      message: `Rented ${model.name} (${rentalTail}) for this flight. $${model.rental_price_per_flight.toLocaleString()} deducted (+$${equityCredit.toLocaleString()} credited to rent-to-own equity!).`,
      pilot,
      activeAircraft: pilot.active_aircraft,
      rentedPlane,
      rentToOwnEquity: pilot.rent_to_own_equity || {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Switch active aircraft to one of the planes in pilot's fleet
 */
export async function selectActiveAircraft(req, res) {
  try {
    const { tailNumber, modelId } = req.body;
    if (!tailNumber && !modelId) {
      return res.status(400).json({ error: 'tailNumber or modelId is required.' });
    }

    let pilot = await Pilot.findOne();
    if (!pilot || !pilot.fleet || pilot.fleet.length === 0) {
      return res.status(404).json({ error: 'No aircraft found in pilot fleet.' });
    }

    let fleetPlane = null;
    if (tailNumber) {
      fleetPlane = pilot.fleet.find((p) => p.tail_number === tailNumber.trim().toUpperCase());
    }
    if (!fleetPlane && modelId) {
      fleetPlane = pilot.fleet.find((p) => p.model_id === modelId.toLowerCase());
    }

    if (!fleetPlane) {
      return res.status(404).json({ error: 'Specified aircraft not found in your fleet.' });
    }

    // Look up full specs
    const model = await Aircraft.findOne({ model_id: fleetPlane.model_id });
    if (!model) {
      return res.status(404).json({ error: `Aircraft model '${fleetPlane.model_id}' not found in catalog.` });
    }

    if (fleetPlane.is_rental && model.rental_price_per_flight) {
      fleetPlane.rental_price_per_flight = model.rental_price_per_flight;
    }

    pilot.active_aircraft = {
      model_id: model.model_id,
      name: model.name,
      tail_number: fleetPlane.tail_number,
      category: model.category,
      is_rental: Boolean(fleetPlane.is_rental),
      rental_price_per_flight: fleetPlane.is_rental ? (model.rental_price_per_flight || fleetPlane.rental_price_per_flight || 0) : 0,
      rental_flights_paid: fleetPlane.rental_flights_paid || 0,
      accumulated_equity: fleetPlane.is_rental
        ? ((pilot.rent_to_own_equity && Number(pilot.rent_to_own_equity[model.model_id])) || fleetPlane.accumulated_equity || 0)
        : 0,
      flight_hours: fleetPlane.flight_hours || 0,
      is_loaner: Boolean(fleetPlane.is_loaner),
      cruise_speed_kts: model.cruise_speed_kts,
      max_range_nm: model.max_range_nm,
      max_cargo_lbs: model.max_cargo_lbs,
      max_pax: model.max_pax,
      min_runway_ft: model.min_runway_ft,
      fuel_type: model.fuel_type,
      fuel_burn_gph: model.fuel_burn_gph
    };

    await pilot.save();
    flightStateMachine.setActiveAircraft(pilot.active_aircraft);

    // Regenerate jobs scaled to new aircraft
    try {
      await generateJobsForAirport(pilot.current_icao, { aircraft: pilot.active_aircraft });
    } catch (jobErr) {
      console.warn('[Fleet] Warning: Failed to regenerate jobs for airport after aircraft selection:', jobErr.message);
    }

    res.json({
      message: `Active aircraft switched to ${model.name} (${fleetPlane.tail_number}).`,
      pilot,
      activeAircraft: pilot.active_aircraft
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Helper to generate a free starter loaner Cessna 172
 */
function createStarterLoanerC172() {
  const loanerSuffix = Math.floor(100 + Math.random() * 899);
  const tailNumber = `N${loanerSuffix}LN`;
  const loanerPlane = {
    model_id: 'c172',
    name: 'Cessna 172 Skyhawk (Loaner)',
    tail_number: tailNumber,
    category: 'single_prop',
    is_rental: true,
    rental_price_per_flight: 0,
    rental_flights_paid: 9999,
    is_loaner: true,
    purchased_at: new Date(),
    flight_hours: 0
  };
  const activeAircraft = {
    model_id: 'c172',
    name: 'Cessna 172 Skyhawk (Loaner)',
    tail_number: tailNumber,
    category: 'single_prop',
    is_rental: true,
    rental_price_per_flight: 0,
    rental_flights_paid: 9999,
    is_loaner: true,
    cruise_speed_kts: 120,
    max_range_nm: 500,
    max_cargo_lbs: 500,
    max_pax: 3,
    min_runway_ft: 1600,
    fuel_type: '100LL',
    fuel_burn_gph: 9.0
  };
  return { loanerPlane, activeAircraft };
}

/**
 * Sell an owned aircraft from pilot's fleet with flight hours depreciation
 */
export async function sellAircraft(req, res) {
  try {
    const { tailNumber } = req.body;
    if (!tailNumber) {
      return res.status(400).json({ error: 'tailNumber is required to sell an aircraft.' });
    }

    const cleanTail = tailNumber.trim().toUpperCase();

    let pilot = await Pilot.findOne();
    if (!pilot || !pilot.fleet || pilot.fleet.length === 0) {
      return res.status(404).json({ error: 'No aircraft found in pilot fleet.' });
    }

    // Check if in flight
    if (
      flightStateMachine &&
      [FLIGHT_PHASES.DEPARTED, FLIGHT_PHASES.EN_ROUTE, FLIGHT_PHASES.TOUCHDOWN].includes(
        flightStateMachine.phase
      ) &&
      flightStateMachine.activeJob &&
      pilot.active_aircraft?.tail_number === cleanTail
    ) {
      return res.status(400).json({
        error: `Cannot sell aircraft ${cleanTail} while a flight is currently in progress (${flightStateMachine.phase}). Please complete or cancel the flight first.`
      });
    }

    const planeIndex = pilot.fleet.findIndex((p) => p.tail_number === cleanTail);
    if (planeIndex === -1) {
      return res.status(404).json({ error: `Aircraft ${cleanTail} not found in your hangar.` });
    }

    const plane = pilot.fleet[planeIndex];
    if (plane.is_rental) {
      return res.status(400).json({
        error: `${plane.name} (${cleanTail}) is a rental lease, not an owned aircraft. Please use the Return Rental option instead.`
      });
    }

    // Lookup original purchase price
    const model = await Aircraft.findOne({ model_id: plane.model_id });
    if (!model) {
      return res.status(404).json({ error: `Aircraft model '${plane.model_id}' not found in catalog.` });
    }

    // Calculate resale value factoring in flight hours
    const resale = calculateAircraftResaleValue(model.purchase_price, plane.flight_hours || 0);

    // Credit pilot balance
    pilot.balance = (pilot.balance || 0) + resale.resaleValue;

    // Remove from fleet
    pilot.fleet.splice(planeIndex, 1);

    let activeSwitched = false;
    let loanerProvided = false;

    // If hangar is now empty, automatically provide a free rented loaner Cessna 172
    if (pilot.fleet.length === 0) {
      const { loanerPlane, activeAircraft } = createStarterLoanerC172();
      pilot.fleet.push(loanerPlane);
      pilot.active_aircraft = activeAircraft;
      activeSwitched = true;
      loanerProvided = true;
    } else if (pilot.active_aircraft && pilot.active_aircraft.tail_number === cleanTail) {
      activeSwitched = true;
      const nextPlane = pilot.fleet[0];
      const nextModel = await Aircraft.findOne({ model_id: nextPlane.model_id });
      if (nextModel) {
        pilot.active_aircraft = {
          model_id: nextModel.model_id,
          name: nextModel.name,
          tail_number: nextPlane.tail_number,
          category: nextModel.category,
          is_rental: Boolean(nextPlane.is_rental),
          rental_price_per_flight: nextPlane.rental_price_per_flight || nextModel.rental_price_per_flight || 0,
          rental_flights_paid: nextPlane.rental_flights_paid || 0,
          is_loaner: Boolean(nextPlane.is_loaner),
          cruise_speed_kts: nextModel.cruise_speed_kts,
          max_range_nm: nextModel.max_range_nm,
          max_cargo_lbs: nextModel.max_cargo_lbs,
          max_pax: nextModel.max_pax,
          min_runway_ft: nextModel.min_runway_ft,
          fuel_type: nextModel.fuel_type,
          fuel_burn_gph: nextModel.fuel_burn_gph
        };
      }
    }

    await pilot.save();

    // Regenerate jobs for current base with the active aircraft
    try {
      await generateJobsForAirport(pilot.current_icao, { aircraft: pilot.active_aircraft });
    } catch (jobErr) {
      console.warn('[Fleet] Warning: Failed to regenerate jobs for airport after aircraft sale:', jobErr.message);
    }

    const message = loanerProvided
      ? `Successfully sold ${plane.name} (${cleanTail}) for $${resale.resaleValue.toLocaleString()}! Airbound Operations provided a free rented Cessna 172 Skyhawk loaner (${pilot.active_aircraft.tail_number}) for your hangar.`
      : `Successfully sold ${plane.name} (${cleanTail}) for $${resale.resaleValue.toLocaleString()}!`;

    res.json({
      message,
      soldPlane: {
        name: plane.name,
        tailNumber: cleanTail,
        flightHours: plane.flight_hours || 0,
        purchasePrice: model.purchase_price,
        resaleValue: resale.resaleValue,
        totalDepreciation: resale.totalDepreciation,
        depreciationPercent: resale.totalDepreciationPercent,
        baseDepreciationPercent: resale.baseDepreciationPercent,
        hourlyDepreciationPercent: resale.hourlyDepreciationPercent
      },
      pilot,
      activeAircraft: pilot.active_aircraft,
      activeSwitched,
      loanerProvided
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Return a leased/rented aircraft to fleet lessor (or return an owned aircraft, crediting resale proceeds)
 */
export async function returnAircraft(req, res) {
  try {
    const { tailNumber } = req.body;
    if (!tailNumber) {
      return res.status(400).json({ error: 'tailNumber is required to return a rented aircraft.' });
    }

    const cleanTail = tailNumber.trim().toUpperCase();

    let pilot = await Pilot.findOne();
    if (!pilot || !pilot.fleet || pilot.fleet.length === 0) {
      return res.status(404).json({ error: 'No aircraft found in pilot fleet.' });
    }

    // Check if in flight
    if (
      flightStateMachine &&
      [FLIGHT_PHASES.DEPARTED, FLIGHT_PHASES.EN_ROUTE, FLIGHT_PHASES.TOUCHDOWN].includes(
        flightStateMachine.phase
      ) &&
      flightStateMachine.activeJob &&
      pilot.active_aircraft?.tail_number === cleanTail
    ) {
      return res.status(400).json({
        error: `Cannot return aircraft ${cleanTail} while a flight is currently in progress (${flightStateMachine.phase}). Please complete or cancel the flight first.`
      });
    }

    const planeIndex = pilot.fleet.findIndex((p) => p.tail_number === cleanTail);
    if (planeIndex === -1) {
      return res.status(404).json({ error: `Aircraft ${cleanTail} not found in your hangar.` });
    }

    const plane = pilot.fleet[planeIndex];

    // If an owned plane is returned, calculate resale proceeds and credit pilot balance so they don't forfeit value
    let resale = null;
    if (!plane.is_rental) {
      const model = await Aircraft.findOne({ model_id: plane.model_id });
      if (model) {
        resale = calculateAircraftResaleValue(model.purchase_price, plane.flight_hours || 0);
        pilot.balance = (pilot.balance || 0) + resale.resaleValue;
      }
    }

    // Remove from fleet
    pilot.fleet.splice(planeIndex, 1);

    let activeSwitched = false;
    let loanerProvided = false;

    // If hangar is now empty, automatically provide a free rented loaner Cessna 172
    if (pilot.fleet.length === 0) {
      const { loanerPlane, activeAircraft } = createStarterLoanerC172();
      pilot.fleet.push(loanerPlane);
      pilot.active_aircraft = activeAircraft;
      activeSwitched = true;
      loanerProvided = true;
    } else if (pilot.active_aircraft && pilot.active_aircraft.tail_number === cleanTail) {
      activeSwitched = true;
      const nextPlane = pilot.fleet[0];
      const nextModel = await Aircraft.findOne({ model_id: nextPlane.model_id });
      if (nextModel) {
        pilot.active_aircraft = {
          model_id: nextModel.model_id,
          name: nextModel.name,
          tail_number: nextPlane.tail_number,
          category: nextModel.category,
          is_rental: Boolean(nextPlane.is_rental),
          rental_price_per_flight: nextPlane.rental_price_per_flight || nextModel.rental_price_per_flight || 0,
          rental_flights_paid: nextPlane.rental_flights_paid || 0,
          is_loaner: Boolean(nextPlane.is_loaner),
          cruise_speed_kts: nextModel.cruise_speed_kts,
          max_range_nm: nextModel.max_range_nm,
          max_cargo_lbs: nextModel.max_cargo_lbs,
          max_pax: nextModel.max_pax,
          min_runway_ft: nextModel.min_runway_ft,
          fuel_type: nextModel.fuel_type,
          fuel_burn_gph: nextModel.fuel_burn_gph
        };
      }
    }

    await pilot.save();

    // Regenerate jobs for current base with the active aircraft
    try {
      await generateJobsForAirport(pilot.current_icao, { aircraft: pilot.active_aircraft });
    } catch (jobErr) {
      console.warn('[Fleet] Warning: Failed to regenerate jobs for airport after returning aircraft:', jobErr.message);
    }

    let message;
    if (resale) {
      message = loanerProvided
        ? `Sold ${plane.name} (${cleanTail}) for $${resale.resaleValue.toLocaleString()}! Airbound Operations provided a free rented Cessna 172 Skyhawk loaner (${pilot.active_aircraft.tail_number}) for your hangar.`
        : `Sold ${plane.name} (${cleanTail}) for $${resale.resaleValue.toLocaleString()}!`;
    } else {
      message = loanerProvided
        ? `Returned leased ${plane.name} (${cleanTail}) to lessor. Airbound Operations provided a free rented Cessna 172 Skyhawk loaner (${pilot.active_aircraft.tail_number}) for your hangar.`
        : `Returned leased ${plane.name} (${cleanTail}) to fleet lessor.`;
    }

    res.json({
      message,
      returnedPlane: {
        name: plane.name,
        tailNumber: cleanTail
      },
      resaleValue: resale ? resale.resaleValue : 0,
      pilot,
      activeAircraft: pilot.active_aircraft,
      activeSwitched,
      loanerProvided
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}



