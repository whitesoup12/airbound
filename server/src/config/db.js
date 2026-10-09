import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let memoryServer = null;
let cachedPromise = null;

/**
 * Connect to 100% In-Memory isolated MongoDB (RAM only)
 * Completely isolated from Atlas and network, zero persistence, discarded on test exit.
 */
export async function connectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create();
  }
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  console.log(`[Test Database] Connected to 100% In-Memory isolated database (RAM only) at: ${memUri}`);
  return memUri;
}

/**
 * Connect to MongoDB database:
 * 1. Test Mode: Ephemeral RAM-only database
 * 2. Cloud Mode (MONGODB_URI provided): Connects to MongoDB Atlas / remote cluster
 * 3. Desktop Mode (Default, no URI): Automatically boots embedded persistent MongoDB on local disk (./data/db)
 */
export async function connectDB(customUri = null) {
  // Hard guard: When running in test environment, NEVER touch disk or Atlas
  if (process.env.NODE_ENV === 'test') {
    return connectTestDB();
  }

  // Reuse existing active connection if already connected (state 1 = connected)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Reuse pending connection promise if currently connecting
  if (cachedPromise && mongoose.connection.readyState === 2) {
    return cachedPromise;
  }

  const uri = customUri || process.env.MONGODB_URI;

  if (uri) {
    try {
      cachedPromise = mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10
      });
      await cachedPromise;
      console.log(`[Database] Connected to external MongoDB at: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
      return mongoose.connection;
    } catch (err) {
      cachedPromise = null;
      console.error(`[Database] Connection to specified URI failed: ${err.message}`);
      if (process.env.ALLOW_MEMORY_FALLBACK === 'true') {
        console.warn('[Database] Falling back to in-memory database...');
        return connectTestDB();
      }
      throw err;
    }
  }

  // Desktop Mode: Launch embedded persistent MongoDB storing data in ./data/db
  try {
    const dbDir = process.env.AIRBOUND_DATA_DIR
      ? path.resolve(process.env.AIRBOUND_DATA_DIR)
      : path.resolve(process.cwd(), 'data', 'db');

    fs.mkdirSync(dbDir, { recursive: true });

    // Detect bundled or system MongoDB binary to skip download and start instantly
    const possibleMongodPaths = [
      process.env.MONGOMS_SYSTEM_BINARY,
      process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'mongod.exe') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'server', 'bin', 'mongod.exe') : null,
      path.resolve(__dirname, '../bin/mongod.exe'),
      path.resolve(__dirname, '../../bin/mongod.exe')
    ].filter(Boolean);

    const foundMongod = possibleMongodPaths.find((p) => fs.existsSync(p));
    if (foundMongod && !process.env.MONGOMS_SYSTEM_BINARY) {
      process.env.MONGOMS_SYSTEM_BINARY = foundMongod;
      console.log(`[Database] Using pre-bundled MongoDB engine: ${foundMongod}`);
    }

    if (!memoryServer) {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: dbDir,
          storageEngine: 'wiredTiger'
        }
      });
    }

    const localUri = memoryServer.getUri();
    cachedPromise = mongoose.connect(localUri);
    await cachedPromise;

    console.log(`[Database] Connected to local persistent database at: ${dbDir}`);
    console.log(`[Database] Embedded MongoDB engine active at: ${localUri}`);
    return mongoose.connection;
  } catch (embeddedErr) {
    cachedPromise = null;
    console.warn(`[Database] Could not launch persistent embedded MongoDB (${embeddedErr.message}). Falling back to ephemeral in-memory.`);
    return connectTestDB();
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
