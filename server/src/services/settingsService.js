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

const DEFAULT_SETTINGS = {
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
    const updated = {
      ...current,
      ...partial,
      database: {
        ...current.database,
        ...(partial.database || {})
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
    return settings.database.hostedUri;
  }
  return process.env.MONGODB_URI || null;
}

export default {
  getSettings,
  saveSettings,
  getActiveDbUri
};
