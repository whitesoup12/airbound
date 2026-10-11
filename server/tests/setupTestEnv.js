// Enforce 100% Test Isolation: Protect user's real career database in Atlas
process.env.NODE_ENV = 'test';

// Wipe Atlas connection string from process memory so tests CANNOT reach production
delete process.env.MONGODB_URI;

// Set ephemeral port if Express server starts
process.env.PORT = '0';

console.log('[Test Environment] 100% isolated in-memory test mode active. Atlas connection string deleted from process.');

