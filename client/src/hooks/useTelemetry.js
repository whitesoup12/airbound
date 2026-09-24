import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

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
    isMock: false
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

  useEffect(() => {
    // Socket.IO client connects to current host or proxy
    const socket = io('/', {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to backend');
    });

    socket.on('connectionStatus', (status) => {
      setConnectionStatus(status);
    });

    socket.on('telemetry', (data) => {
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
    });

    socket.on('phaseChange', ({ phase: newPhase, details }) => {
      setPhase(newPhase);
      if (details?.aircraftValidation !== undefined) {
        setAircraftValidation(details.aircraftValidation);
      }
      if (details?.flightSeconds !== undefined) {
        setFlightSeconds(details.flightSeconds);
      }
      if (details?.airborneSeconds !== undefined) {
        setAirborneSeconds(details.airborneSeconds);
      }
      if (details?.isPaused !== undefined) {
        setIsPaused(Boolean(details.isPaused));
      }
    });

    socket.on('flightCompleted', (result) => {
      setCompletedFlight(result);
      setActiveJob(null);
      if (onFlightCompleted) {
        onFlightCompleted(result);
      }
    });

    return () => {
      socket.disconnect();
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

