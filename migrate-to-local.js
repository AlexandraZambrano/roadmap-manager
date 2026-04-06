/**
 * migrate-to-local.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Copies every collection from the CLOUD MongoDB (MONGO_URI_CLOUD) to the
 * LOCAL Docker MongoDB (default: mongodb://localhost:27017/bootcamp-manager).
 *
 * Usage
 * ─────
 *   1.  Make sure Docker is running and the mongo container is up:
 *         docker compose up -d mongo
 *
 *   2.  Fill in MONGO_URI_CLOUD in your .env file with the Atlas connection
 *       string of your current cloud database.
 *
 *   3.  Run from the project root:
 *         node migrate-to-local.js
 *
 *       Optional flags:
 *         --drop        Drop each local collection before inserting (clean slate)
 *         --collections=Col1,Col2   Only migrate these collections
 *
 * Notes
 * ─────
 * • The script uses the native MongoDB driver (already a transitive dep of
 *   mongoose) so no new package is needed.
 * • _id values are preserved, so all existing references / ObjectIds remain
 *   valid after the migration.
 * • Run the script from the HOST machine (not inside docker) because
 *   MONGO_URI_CLOUD needs internet access and the local mongo port 27017
 *   is exposed to the host via docker-compose.
 */

import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env manually (no dotenv dependency required) ──────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '.env');

if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Parse CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dropFirst = args.includes('--drop');
const colFilter = args
  .find(a => a.startsWith('--collections='))
  ?.replace('--collections=', '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean) || [];

// ── Connection strings ───────────────────────────────────────────────────────
const CLOUD_URI = process.env.MONGO_URI_CLOUD;
const LOCAL_URI = process.env.MONGO_URI_LOCAL || 'mongodb://localhost:27017/bootcamp-manager';

if (!CLOUD_URI || CLOUD_URI.includes('<user>')) {
  console.error('\n❌  MONGO_URI_CLOUD is not set in your .env file.');
  console.error('    Edit .env and fill in the Atlas connection string, then re-run.\n');
  process.exit(1);
}

// ── Derive database names from URIs ─────────────────────────────────────────
function dbName(uri) {
  const url = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
  const path = url.pathname.replace('/', '');
  return path.split('?')[0] || 'bootcamp-manager';
}

const cloudDb = dbName(CLOUD_URI);
const localDb = dbName(LOCAL_URI);

// ── Main ─────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\n📦  Roadmap Manager — Cloud → Local migration');
  console.log('━'.repeat(60));
  console.log(`  Source  : ${CLOUD_URI.replace(/:\/\/.*@/, '://<credentials>@')}`);
  console.log(`  Target  : ${LOCAL_URI}`);
  console.log(`  DB      : ${cloudDb} → ${localDb}`);
  console.log(`  Drop?   : ${dropFirst}`);
  if (colFilter.length) console.log(`  Filter  : ${colFilter.join(', ')}`);
  console.log('━'.repeat(60) + '\n');

  let cloudClient, localClient;

  try {
    console.log('🔌  Connecting to cloud…');
    cloudClient = new MongoClient(CLOUD_URI, { serverSelectionTimeoutMS: 15000 });
    await cloudClient.connect();

    console.log('🔌  Connecting to local Docker Mongo…');
    localClient = new MongoClient(LOCAL_URI, { serverSelectionTimeoutMS: 10000 });
    await localClient.connect();

    const source = cloudClient.db(cloudDb);
    const target = localClient.db(localDb);

    // List collections
    const allCollections = await source.listCollections().toArray();
    const collections = allCollections
      .map(c => c.name)
      .filter(name => !name.startsWith('system.'))
      .filter(name => colFilter.length === 0 || colFilter.includes(name));

    if (collections.length === 0) {
      console.log('⚠️   No collections found (or none matched the filter).');
      return;
    }

    console.log(`📋  Collections to migrate: ${collections.join(', ')}\n`);

    let totalDocs = 0;

    for (const colName of collections) {
      const srcCol = source.collection(colName);
      const dstCol = target.collection(colName);

      const count = await srcCol.countDocuments();
      process.stdout.write(`  ▸ ${colName} (${count} docs)… `);

      if (count === 0) {
        console.log('skipped (empty)');
        continue;
      }

      if (dropFirst) {
        await dstCol.drop().catch(() => {}); // ignore if not exists
      }

      // Stream documents in batches of 500
      const BATCH = 500;
      let inserted = 0;
      const cursor = srcCol.find({});
      let batch = [];

      for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length === BATCH) {
          await dstCol.insertMany(batch, { ordered: false }).catch(handleDuplicates);
          inserted += batch.length;
          batch = [];
        }
      }
      if (batch.length) {
        await dstCol.insertMany(batch, { ordered: false }).catch(handleDuplicates);
        inserted += batch.length;
      }

      totalDocs += inserted;
      console.log(`✅  ${inserted} inserted`);
    }

    console.log('\n' + '━'.repeat(60));
    console.log(`✅  Migration complete — ${totalDocs} total documents copied.`);
    console.log('━'.repeat(60) + '\n');
  } finally {
    await cloudClient?.close();
    await localClient?.close();
  }
}

function handleDuplicates(err) {
  // insertMany with ordered:false throws on duplicates but still inserts non-duplicates
  if (err.code === 11000 || err.code === 11001) {
    // duplicate key — record already exists locally, safe to ignore
    return;
  }
  throw err;
}

migrate().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
