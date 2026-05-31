const fs = require('fs/promises');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'portfolio';
const localDbPath = path.join(process.cwd(), '.local-data', 'portfolio-db.json');
const allowLocalFallback = process.env.ALLOW_LOCAL_DB_FALLBACK === 'true' || process.env.NODE_ENV !== 'production';

let cachedClient = null;
let cachedDb = null;
let localDbCache = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compareValues(left, right) {
  const leftTime = new Date(left || 0).getTime();
  const rightTime = new Date(right || 0).getTime();

  if (leftTime === rightTime) {
    return 0;
  }

  return leftTime > rightTime ? 1 : -1;
}

function matchesFilter(document, filter = {}) {
  return Object.entries(filter).every(([key, expectedValue]) => {
    const actualValue = document[key];

    if (key === '_id') {
      return String(actualValue) === String(expectedValue);
    }

    return String(actualValue) === String(expectedValue);
  });
}

async function readLocalDb() {
  if (localDbCache) {
    return localDbCache;
  }

  try {
    const raw = await fs.readFile(localDbPath, 'utf8');
    localDbCache = JSON.parse(raw);
  } catch (error) {
    localDbCache = { collections: {} };
  }

  localDbCache.collections = localDbCache.collections || {};
  return localDbCache;
}

async function writeLocalDb(dbState) {
  localDbCache = dbState;
  await fs.mkdir(path.dirname(localDbPath), { recursive: true });
  await fs.writeFile(localDbPath, JSON.stringify(dbState, null, 2), 'utf8');
}

function createLocalCursor(collectionName, filter) {
  let resultsPromise = (async () => {
    const dbState = await readLocalDb();
    const documents = dbState.collections[collectionName] || [];
    return documents.filter((document) => matchesFilter(document, filter));
  })();

  return {
    sort(sortSpec = {}) {
      resultsPromise = resultsPromise.then((results) => {
        const [[field, direction]] = Object.entries(sortSpec);

        if (!field) {
          return results;
        }

        return [...results].sort((left, right) => {
          const comparison = compareValues(left[field], right[field]);
          return direction < 0 ? -comparison : comparison;
        });
      });

      return this;
    },
    limit(maxCount) {
      resultsPromise = resultsPromise.then((results) => results.slice(0, maxCount));
      return this;
    },
    async toArray() {
      return clone(await resultsPromise);
    },
  };
}

function createLocalDatabase() {
  return {
    collection(collectionName) {
      return {
        find(filter = {}) {
          return createLocalCursor(collectionName, filter);
        },
        async insertOne(document) {
          const dbState = await readLocalDb();
          const documents = dbState.collections[collectionName] || [];
          const insertedId = document._id ? String(document._id) : new ObjectId().toHexString();
          const storedDocument = { ...clone(document), _id: insertedId };

          documents.unshift(storedDocument);
          dbState.collections[collectionName] = documents;
          await writeLocalDb(dbState);

          return { acknowledged: true, insertedId };
        },
        async deleteOne(filter = {}) {
          const dbState = await readLocalDb();
          const documents = dbState.collections[collectionName] || [];
          const remainingDocuments = documents.filter((document) => !matchesFilter(document, filter));

          dbState.collections[collectionName] = remainingDocuments;
          await writeLocalDb(dbState);

          return { acknowledged: true, deletedCount: documents.length - remainingDocuments.length };
        },
      };
    },
  };
}

async function connectToDatabase() {
  if (!mongoUri) {
    if (allowLocalFallback) {
      console.warn('MONGODB_URI is not set. Using local file storage.');
      return { client: null, db: createLocalDatabase(), isLocalFallback: true };
    }

    throw new Error('MONGODB_URI is not set.');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb, isLocalFallback: false };
  }

  try {
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();

    const db = client.db(databaseName);
    cachedClient = client;
    cachedDb = db;

    return { client, db, isLocalFallback: false };
  } catch (error) {
    if (allowLocalFallback) {
      console.warn('MongoDB connection failed. Using local file storage.', error.message);
      return { client: null, db: createLocalDatabase(), isLocalFallback: true };
    }

    throw error;
  }
}

module.exports = connectToDatabase;
