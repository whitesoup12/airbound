import mongoose from 'mongoose';

let memoryServer = null;

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

let cachedPromise = null;

export async function connectDB(customUri = null) {
  // Hard guard: When running in test environment, NEVER connect to Atlas
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
      console.log(`[Database] Connected to MongoDB at: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
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

  // Fallback to in-memory MongoDB only if zero URI is configured
  console.log('[Database] No MONGODB_URI configured, using in-memory database.');
  return connectTestDB();
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

