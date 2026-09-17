import { open, Protocol, SimConnectDataType, SimConnectPeriod, DataRequestFlag } from 'node-simconnect';

console.log('Testing node-simconnect connection to MSFS 2024...');

async function testWithProtocol(protoName, protoVal) {
  console.log(`\n--- Attempting open with Protocol.${protoName} (${protoVal}) ---`);
  try {
    const result = await open('Airbound Test', protoVal);
    console.log('SUCCESS! Connected to SimConnect:', result.recvOpen);
    const { handle, recvOpen } = result;
    
    const DEF_ID = 1;
    const REQ_ID = 1;
    handle.addToDataDefinition(DEF_ID, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(DEF_ID, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(DEF_ID, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(DEF_ID, 'SIM ON GROUND', 'bool', SimConnectDataType.INT32);
    handle.addToDataDefinition(DEF_ID, 'AIRSPEED TRUE', 'knots', SimConnectDataType.FLOAT64);

    handle.requestDataOnSimObject(REQ_ID, DEF_ID, 0, SimConnectPeriod.SECOND, DataRequestFlag.DATA_REQUEST_FLAG_DEFAULT);

    handle.on('simObjectData', (recvSimObjectData) => {
      if (recvSimObjectData.requestID === REQ_ID) {
        const lat = recvSimObjectData.data.readFloat64(0);
        const lon = recvSimObjectData.data.readFloat64(8);
        const alt = recvSimObjectData.data.readFloat64(16);
        const onGround = Boolean(recvSimObjectData.data.readInt32(24));
        const tas = recvSimObjectData.data.readFloat64(28);
        console.log(`Live telemetry received! Lat=${lat.toFixed(5)}, Lon=${lon.toFixed(5)}, Alt=${Math.round(alt)}ft, OnGround=${onGround}, TAS=${Math.round(tas)}kts`);
        handle.close();
        process.exit(0);
      }
    });

    handle.on('error', (err) => {
      console.error('SimConnect handle error:', err);
    });

    handle.on('close', () => {
      console.log('SimConnect closed');
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));
    return true;
  } catch (err) {
    console.error(`Failed with Protocol.${protoName}:`, err.message);
    return false;
  }
}

async function run() {
  // Test FSX_SP2 first
  const ok1 = await testWithProtocol('FSX_SP2', Protocol.FSX_SP2);
  if (!ok1) {
    // Try KittyHawk
    await testWithProtocol('KittyHawk', Protocol.KittyHawk);
  }
}

run();

