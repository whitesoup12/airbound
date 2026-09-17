import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Aircraft from '../models/Aircraft.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedAircraftCatalog() {
  const catalogPath = path.join(__dirname, 'aircraftCatalog.json');
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const bulkOps = catalogData.map((plane) => ({
    updateOne: {
      filter: { model_id: plane.model_id },
      update: { $set: plane },
      upsert: true
    }
  }));

  await Aircraft.bulkWrite(bulkOps);
  console.log(`[Aircraft Seed] Seeded ${catalogData.length} aircraft models into dealership catalog.`);
}

if (process.argv[1] && process.argv[1].endsWith('seedAircraft.js')) {
  import('dotenv').then(async (dotenv) => {
    dotenv.default.config({ path: path.join(__dirname, '../../.env') });
    const mongoose = (await import('mongoose')).default;
    await mongoose.connect(process.env.MONGODB_URI);
    await seedAircraftCatalog();
    await mongoose.disconnect();
    console.log('[Aircraft Seed] Direct run complete.');
    process.exit(0);
  });
}

