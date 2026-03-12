import { Client, Databases, ID, Permission, Role } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "polcompapp";
const apiKey = process.env.NEXT_BACKEND_APPWRITE_API_KEY ?? "standard_e08ed93c07a7e108864251fde4cc9af9ffda2d6751b700ab0b373fddf91e8b5cd654b605f3546c719db1b3f18713495fe855bdefc1e7386a38ba7dad9cbaf9e215ec81d93a29774bffeb28525d69a1233aaa3dc74f8c6b2338a20caa91d0af54182620541de4ffd91feed94904a6863cf1435fa3f04047862b4ddb44d359aaf6";
const databaseId = process.env.APPWRITE_DATABASE_ID ?? "polcomb_prod_db";
const collectionId = process.env.APPWRITE_RESULTS_COLLECTION_ID ?? "polcomp_results";

if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
  console.error("Missing required env vars: endpoint/projectId/apiKey/databaseId/collectionId.");
  process.exit(1);
}

const client = new Client();
client.setEndpoint(endpoint);
client.setProject(projectId);
client.setKey(apiKey);
const databases = new Databases(client);

const REQUIRED_ATTRIBUTES = [
  "createdAtIso",
  "category",
  "answersJson",
  "analysisJson",
  "userId",
  "mode",
  "respondentName",
  "selectedParty",
  "initialEcon",
  "initialSocial",
];

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

  if (!(await hasAttribute("selectedParty"))) {
    await databases.createStringAttribute(databaseId, collectionId, "selectedParty", 64, true);
    console.log("Created attribute: selectedParty");
  }

  if (!(await hasAttribute("initialEcon"))) {
    await databases.createFloatAttribute(databaseId, collectionId, "initialEcon", false, -10, 10);
    console.log("Created attribute: initialEcon");
  }

  if (!(await hasAttribute("initialSocial"))) {
    await databases.createFloatAttribute(databaseId, collectionId, "initialSocial", false, -10, 10);
    console.log("Created attribute: initialSocial");
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

  if (!(await hasIndex("idx_selected_party"))) {
    await databases.createIndex(databaseId, collectionId, "idx_selected_party", "key", ["selectedParty"]);
    console.log("Created index: idx_selected_party");
  }

  if (!(await hasIndex("idx_category_mode"))) {
    await databases.createIndex(databaseId, collectionId, "idx_category_mode", "key", ["category", "mode"]);
    console.log("Created index: idx_category_mode");
  }

  if (!(await hasIndex("idx_party_mode"))) {
    await databases.createIndex(databaseId, collectionId, "idx_party_mode", "key", ["selectedParty", "mode"]);
    console.log("Created index: idx_party_mode");
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
