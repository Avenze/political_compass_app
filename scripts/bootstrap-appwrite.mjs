import { Client, Databases, ID, Permission, Role } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const apiKey = process.env.NEXT_BACKEND_APPWRITE_API_KEY ?? "";
const databaseId = process.env.APPWRITE_DATABASE_ID ?? "";
const collectionId = process.env.APPWRITE_RESULTS_COLLECTION_ID ?? "";

if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
  console.error("Missing required env vars: endpoint/projectId/apiKey/databaseId/collectionId.");
  process.exit(1);
}

const client = new Client();
client.setEndpoint(endpoint);
client.setProject(projectId);
client.setKey(apiKey);
const databases = new Databases(client);

const REQUIRED_ATTRIBUTES = ["createdAtIso", "category", "answersJson", "analysisJson", "userId", "mode", "respondentName", "guessEcon", "guessSocial"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDatabase() {
  try {
    await databases.get(databaseId);
    console.log(`Database already exists: ${databaseId}`);
  } catch {
    await databases.create(databaseId, "Political Compass App DB");
    console.log(`Created database: ${databaseId}`);
  }
}

async function ensureCollection() {
  try {
    await databases.getCollection(databaseId, collectionId);
    console.log(`Collection already exists: ${collectionId}`);
  } catch {
    await databases.createCollection(databaseId, collectionId, "Results", [Permission.read(Role.any())], false);
    console.log(`Created collection: ${collectionId}`);
  }
}

async function hasAttribute(key) {
  const attrs = await databases.listAttributes(databaseId, collectionId);
  return attrs.attributes.some((attr) => attr.key === key);
}

async function waitForAttributesAvailable(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attrs = await databases.listAttributes(databaseId, collectionId);
    const available = new Set(attrs.attributes.filter((attr) => attr.status === "available").map((attr) => attr.key));
    const missing = REQUIRED_ATTRIBUTES.filter((key) => !available.has(key));

    if (missing.length === 0) {
      return;
    }

    console.log(`Waiting for attributes to be available (${attempt}/${maxAttempts}): ${missing.join(", ")}`);
    await sleep(1000);
  }

  throw new Error("Timed out waiting for Appwrite attributes to become available");
}

async function hasIndex(key) {
  const indexes = await databases.listIndexes(databaseId, collectionId);
  return indexes.indexes.some((index) => index.key === key);
}

async function ensureAttributes() {
  if (!(await hasAttribute("createdAtIso"))) {
    await databases.createDatetimeAttribute(databaseId, collectionId, "createdAtIso", true);
    console.log("Created attribute: createdAtIso");
  }

  if (!(await hasAttribute("category"))) {
    await databases.createStringAttribute(databaseId, collectionId, "category", 64, false, "direct");
    console.log("Created attribute: category");
  }

  if (!(await hasAttribute("answersJson"))) {
    await databases.createStringAttribute(databaseId, collectionId, "answersJson", 65535, true);
    console.log("Created attribute: answersJson");
  }

  if (!(await hasAttribute("analysisJson"))) {
    await databases.createStringAttribute(databaseId, collectionId, "analysisJson", 65535, true);
    console.log("Created attribute: analysisJson");
  }

  if (!(await hasAttribute("userId"))) {
    await databases.createStringAttribute(databaseId, collectionId, "userId", 64, false);
    console.log("Created attribute: userId");
  }

  if (!(await hasAttribute("mode"))) {
    await databases.createStringAttribute(databaseId, collectionId, "mode", 16, true);
    console.log("Created attribute: mode");
  }

  if (!(await hasAttribute("respondentName"))) {
    await databases.createStringAttribute(databaseId, collectionId, "respondentName", 120, false, "Anonymous");
    console.log("Created attribute: respondentName");
  }

  if (!(await hasAttribute("guessEcon"))) {
    await databases.createFloatAttribute(databaseId, collectionId, "guessEcon", false, -10, 10);
    console.log("Created attribute: guessEcon");
  }

  if (!(await hasAttribute("guessSocial"))) {
    await databases.createFloatAttribute(databaseId, collectionId, "guessSocial", false, -10, 10);
    console.log("Created attribute: guessSocial");
  }
}

async function ensureIndexes() {
  if (!(await hasIndex("idx_category"))) {
    await databases.createIndex(databaseId, collectionId, "idx_category", "key", ["category"]);
    console.log("Created index: idx_category");
  }

  if (!(await hasIndex("idx_created_at"))) {
    await databases.createIndex(databaseId, collectionId, "idx_created_at", "key", ["createdAtIso"]);
    console.log("Created index: idx_created_at");
  }

  if (!(await hasIndex("idx_mode"))) {
    await databases.createIndex(databaseId, collectionId, "idx_mode", "key", ["mode"]);
    console.log("Created index: idx_mode");
  }

  if (!(await hasIndex("idx_category_mode"))) {
    await databases.createIndex(databaseId, collectionId, "idx_category_mode", "key", ["category", "mode"]);
    console.log("Created index: idx_category_mode");
  }
}

async function main() {
  await ensureDatabase();
  await ensureCollection();
  await ensureAttributes();
  await waitForAttributesAvailable();
  await ensureIndexes();



  console.log("Bootstrap complete. Collection is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
