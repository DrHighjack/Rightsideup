import { inject } from "vitest";
import { assertDisposableDatabase } from "./database";

const databaseUrl = inject("databaseUrl");
assertDisposableDatabase(databaseUrl);
process.env.DATABASE_URL = databaseUrl;