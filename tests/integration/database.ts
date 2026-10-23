import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout } from "node:timers/promises";
import type { TestProject } from "vitest/node";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

export function assertDisposableDatabase(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "postgresql:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.username !== "integration" ||
    parsed.password !== "integration" ||
    parsed.pathname !== "/rightsignup_integration" ||
    !parsed.port ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Refusing to use a non-disposable integration database");
  }
}

async function initializeDatabase(databaseUrl: string, project: TestProject) {
  assertDisposableDatabase(databaseUrl);
  const deadline = Date.now() + 30000;
  while (true) {
    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 });
    try {
      await client.connect();
      await client.query("SELECT 1");
      const tables = await client.query(
        "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') AND table_type = 'BASE TABLE'"
      );
      if (tables.rows[0].count !== 0) {
        throw new Error("Refusing to initialize a non-empty integration database");
      }
      break;
    } catch (error) {
      if (Date.now() >= deadline || (error instanceof Error && error.message.includes("non-empty"))) throw error;
      await setTimeout(200);
    } finally {
      await client.end();
    }
  }

  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  project.provide("databaseUrl", databaseUrl);
}

export default async function setup(project: TestProject) {
  const serviceUrl = process.env.INTEGRATION_DATABASE_URL;
  if (serviceUrl) {
    if (process.env.CI !== "true") throw new Error("A service database is allowed only with CI=true");
    await initializeDatabase(serviceUrl, project);
    return;
  }

  const name = `rightsignup-integration-${randomUUID()}`;
  const remove = () => {
    execFileSync("docker", ["rm", "--force", "--volumes", name], { stdio: "pipe" });
  };

  execFileSync("docker", [
    "run", "--detach", "--name", name,
    "--publish", "127.0.0.1::5432",
    "--tmpfs", "/var/lib/postgresql/data",
    "--env", "POSTGRES_USER=integration",
    "--env", "POSTGRES_PASSWORD=integration",
    "--env", "POSTGRES_DB=rightsignup_integration",
    "postgres:16-alpine",
  ], { stdio: "pipe" });

  try {
    const binding = execFileSync("docker", ["port", name, "5432/tcp"], { encoding: "utf8" }).trim();
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error("Unexpected Docker port binding");
    const databaseUrl = `postgresql://integration:integration@${binding}/rightsignup_integration`;
    await initializeDatabase(databaseUrl, project);
    return remove;
  } catch (error) {
    remove();
    throw error;
  }
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}