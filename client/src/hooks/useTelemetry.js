import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getStoredPasscode } from '../api/client.js';

export function useTelemetry(onFlightCompleted) {
  const [telemetry, setTelemetry] = useState({
    latitude: 33.9425,
    longitude: -118.4081,
    altitude: 125,
    heading: 250,
    simOnGround: true,
    airspeedTrue: 0,
    groundSpeed: 0,
    parkingBrake: true,
    engineRunning: true,
    timestamp: Date.now()
  });

  const [phase, setPhase] = useState('STANDBY');
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    isMock: false,
    app: null
  });
  const [destDist, setDestDist] = useState(null);
  const [originDist, setOriginDist] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [aircraftValidation, setAircraftValidation] = useState(null);
  const [completedFlight, setCompletedFlight] = useState(null);
  const [flightSeconds, setFlightSeconds] = useState(0);
  const [airborneSeconds, setAirborneSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const socketRef = useRef(null);
  const isSocketConnectedRef = useRef(false);
  const lastCompletedFlightIdRef = useRef(null);

  useEffect(() => {
    let pollInterval = null;

    // Polling function for REST telemetry fallback (Vercel cloud mode)
    const pollTelemetry = async () => {
      // Skip polling if Socket.IO is actively connected
      if (isSocketConnectedRef.current) return;

      try {
        const passcode = getStoredPasscode();
        const headers = passcode ? { 'x-pilot-passcode': passcode } : {};
        const res = await fetch('/api/telemetry', { headers });

        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent('airbound:unauthorized'));
          return;
        }

        if (!res.ok) return;
        const data = await res.json();

        setConnectionStatus({
          connected: Boolean(data.connected),
          isMock: Boolean(data.isMock),
          app: data.app || null
        });

        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }
        if (data.phase) {
          setPhase(data.phase);
        }
        if (data.activeJob !== undefined) {
          setActiveJob(data.activeJob);
        }
        if (data.destDist !== undefined) {
          setDestDist(data.destDist);
        }
        if (data.originDist !== undefined) {
          setOriginDist(data.originDist);
        }
        if (data.aircraftValidation !== undefined) {
          setAircraftValidation(data.aircraftValidation);
        }
        if (data.flightSeconds !== undefined) {
          setFlightSeconds(data.flightSeconds);
        }
        if (data.airborneSeconds !== undefined) {
          setAirborneSeconds(data.airborneSeconds);
        }
        if (data.isPaused !== undefined) {
          setIsPaused(Boolean(data.isPaused));
        }

        // Detect remote flight completion
        if (data.completedFlight) {
          const compId = data.completedFlight.summary?.job_id ||
            `${data.completedFlight.summary?.origin_icao}-${data.completedFlight.summary?.destination_icao}-${data.completedFlight.summary?.completed_at}`;

          if (lastCompletedFlightIdRef.current !== compId) {
            lastCompletedFlightIdRef.current = compId;
            setCompletedFlight(data.completedFlight);
            setActiveJob(null);
            if (onFlightCompleted) {
              onFlightCompleted(data.completedFlight);
            }
            // Acknowledge completion on server so it doesn't re-trigger
            fetch('/api/telemetry/ack-completion', { method: 'POST', headers }).catch(() => {});
          }
        }
      } catch (err) {
        // Network blip / serverless spin-up
      }
    };

    // Attempt Socket.IO connection (for local development)
    let socket = null;
    try {
      socket = io('/', {
        transports: ['websocket', 'polling'],
        timeout: 2500,
        reconnectionAttempts: 3
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        isSocketConnectedRef.current = true;
      });

      socket.on('disconnect', () => {
        isSocketConnectedRef.current = false;
      });

      socket.on('connect_error', () => {
        isSocketConnectedRef.current = false;
      });

      socket.on('connectionStatus', (status) => {
        setConnectionStatus(status);
      });

      socket.on('telemetry', (data) => {
        if (data.telemetry) setTelemetry(data.telemetry);
        if (data.phase) setPhase(data.phase);
        if (data.activeJob !== undefined) setActiveJob(data.activeJob);
        if (data.destDist !== undefined) setDestDist(data.destDist);
        if (data.originDist !== undefined) setOriginDist(data.originDist);
        if (data.aircraftValidation !== undefined) setAircraftValidation(data.aircraftValidation);
        if (data.flightSeconds !== undefined) setFlightSeconds(data.flightSeconds);
        if (data.airborneSeconds !== undefined) setAirborneSeconds(data.airborneSeconds);
        if (data.isPaused !== undefined) setIsPaused(Boolean(data.isPaused));
      });

      socket.on('phaseChange', ({ phase: newPhase, details }) => {
        setPhase(newPhase);
        if (details?.aircraftValidation !== undefined) setAircraftValidation(details.aircraftValidation);
        if (details?.flightSeconds !== undefined) setFlightSeconds(details.flightSeconds);
        if (details?.airborneSeconds !== undefined) setAirborneSeconds(details.airborneSeconds);
        if (details?.isPaused !== undefined) setIsPaused(Boolean(details.isPaused));
      });

      socket.on('flightCompleted', (result) => {
        setCompletedFlight(result);
        setActiveJob(null);
        if (onFlightCompleted) {
          onFlightCompleted(result);
        }
      });
    } catch {
      isSocketConnectedRef.current = false;
    }

    // Immediate initial poll
    pollTelemetry();

    // Start 1 Hz polling fallback
    pollInterval = setInterval(pollTelemetry, 1000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (socket) socket.disconnect();
    };
  }, [onFlightCompleted]);

  return {
    telemetry,
    phase,
    connectionStatus,
    activeJob,
    setActiveJob,
    aircraftValidation,
    destDist,
    originDist,
    completedFlight,
    setCompletedFlight,
    flightSeconds,
    airborneSeconds,
    isPaused
  };
}

export default useTelemetry;
