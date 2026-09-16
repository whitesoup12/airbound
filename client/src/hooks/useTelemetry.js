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
  const [activeJob, setActiveJob] = useState(null);
  const [completedFlight, setCompletedFlight] = useState(null);

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
    });

    socket.on('phaseChange', ({ phase: newPhase }) => {
      setPhase(newPhase);
    });

    socket.on('flightCompleted', (result) => {
      setCompletedFlight(result);
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
    completedFlight,
    setCompletedFlight
  };
}

