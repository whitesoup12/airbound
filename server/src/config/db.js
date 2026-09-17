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

export async function connectDB(customUri = null) {
  // Hard guard: When running in test environment, NEVER connect to Atlas
  if (process.env.NODE_ENV === 'test') {
    return connectTestDB();
  }

  const uri = customUri || process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000
      });
      console.log(`[Database] Connected to MongoDB at: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
      return;
    } catch (err) {
      console.warn(`[Database] Connection to specified URI failed (${err.message}). Attempting in-memory fallback...`);
    }
  }

  // Fallback to in-memory MongoDB for instant zero-config offline development & testing
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

