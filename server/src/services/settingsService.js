import fs from 'fs';
import path from 'path';

function getSettingsFilePath() {
  if (process.env.AIRBOUND_DATA_DIR) {
    // In Electron, AIRBOUND_DATA_DIR is <userData>/data/db
    // Place settings.json in <userData>/settings.json
    const userDataDir = path.resolve(process.env.AIRBOUND_DATA_DIR, '..', '..');
    return path.join(userDataDir, 'settings.json');
  }
  return path.resolve(process.cwd(), 'data', 'settings.json');
}

/**
 * Normalizes MongoDB connection URI so that if no database name is specified or '/test' is used,
 * it defaults to 'airbound' database instead of MongoDB's default 'test' database.
 */
export function normalizeMongoUri(rawUri, defaultDb = 'airbound') {
  if (!rawUri || typeof rawUri !== 'string') return rawUri;
  const trimmed = rawUri.trim();
  const match = trimmed.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/i);
  if (match) {
    const [, base, pathPart, query = ''] = match;
    if (!pathPart || pathPart === '/' || pathPart.toLowerCase() === '/test') {
      return `${base}/${defaultDb}${query}`;
    }
  }
  return trimmed;
}

const DEFAULT_SETTINGS = {
  hasCompletedOnboarding: false,
  database: {
    type: 'local', // 'local' | 'hosted'
    hostedUri: ''
  },
  msfs: {
    customLogbookPath: ''
  }
};

export function getSettings() {
  try {
    const filePath = getSettingsFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        database: {
          ...DEFAULT_SETTINGS.database,
          ...(data.database || {})
        },
        msfs: {
          ...DEFAULT_SETTINGS.msfs,
          ...(data.msfs || {})
        }
      };
    }
  } catch (err) {
    console.warn('[Settings] Failed to read settings.json:', err.message);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(partial) {
  try {
    const filePath = getSettingsFilePath();
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const current = getSettings();
    const dbUpdate = { ...(partial.database || {}) };
    if (dbUpdate.hostedUri) {
      dbUpdate.hostedUri = normalizeMongoUri(dbUpdate.hostedUri);
    }

    const updated = {
      ...current,
      ...partial,
      database: {
        ...current.database,
        ...dbUpdate
      },
      msfs: {
        ...current.msfs,
        ...(partial.msfs || {})
      }
    };

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
    console.log(`[Settings] Updated settings saved to: ${filePath}`);
    return updated;
  } catch (err) {
    console.error('[Settings] Failed to save settings.json:', err.message);
    throw err;
  }
}

export function getActiveDbUri() {
  const settings = getSettings();
  if (settings.database?.type === 'hosted' && settings.database?.hostedUri) {
    return normalizeMongoUri(settings.database.hostedUri);
  }
  return process.env.MONGODB_URI ? normalizeMongoUri(process.env.MONGODB_URI) : null;
}

export default {
  normalizeMongoUri,
  getSettings,
  saveSettings,
  getActiveDbUri
};
