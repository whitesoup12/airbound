import mongoose from 'mongoose';

let memoryServer = null;

export async function connectDB(customUri = null) {
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
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    await mongoose.connect(memUri);
    console.log(`[Database] Connected to In-Memory MongoDB at: ${memUri}`);
  } catch (err) {
    console.error(`[Database] Could not start In-Memory MongoDB:`, err.message);
    throw err;
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

