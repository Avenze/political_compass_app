import { Account, Client, Databases } from "node-appwrite";

function getEndpoint() {
  return process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
}

function getProjectId() {
  return process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "polcompapp";
}

export function getServerDatabases() {
  const apiKey = process.env.APPWRITE_API_KEY ?? process.env.NEXT_BACKEND_APPWRITE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing APPWRITE_API_KEY (or NEXT_BACKEND_APPWRITE_API_KEY) env var for server-side database access");
  }

  const client = new Client().setEndpoint(getEndpoint()).setProject(getProjectId()).setKey(apiKey);
  return new Databases(client);
}

export function getAccountClientWithSession(sessionSecret: string) {
  const client = new Client().setEndpoint(getEndpoint()).setProject(getProjectId()).setSession(sessionSecret);
  return new Account(client);
}

export function getPublicAccountClient() {
  const client = new Client().setEndpoint(getEndpoint()).setProject(getProjectId());
  return new Account(client);
}
