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

