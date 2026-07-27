const fs = require("fs");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

function getDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  if (fs.existsSync(".env.local")) {
    const envText = fs.readFileSync(".env.local", "utf8");
    const match = envText.match(/^DATABASE_URL\s*=\s*"([^"]*)"/m);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error("DATABASE_URL not found. Set DATABASE_URL or add it to .env.local.");
}

function randomId() {
  return `admin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    throw new Error("Usage: node scripts/upsert-admin-user.js <email> <password>");
  }

  const connectionString = getDatabaseUrl();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const passwordHash = await bcrypt.hash(password, 12);

  const query = `
    INSERT INTO "users" (
      "id",
      "email",
      "passwordHash",
      "firstName",
      "lastName",
      "role",
      "emailVerifiedAt",
      "tags",
      "isOnboarded",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      'ADMIN'::"Role",
      NOW(),
      ARRAY[]::text[],
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT ("email")
    DO UPDATE SET
      "passwordHash" = EXCLUDED."passwordHash",
      "role" = 'ADMIN'::"Role",
      "emailVerifiedAt" = NOW(),
      "tags" = array_remove(COALESCE("users"."tags", ARRAY[]::text[]), 'INACTIVE'),
      "updatedAt" = NOW()
    RETURNING "id", "email", "role", "emailVerifiedAt", "tags";
  `;

  const result = await client.query(query, [
    randomId(),
    email.trim().toLowerCase(),
    passwordHash,
    "Admin",
    "User",
  ]);

  console.log("Admin user upserted:");
  console.log(JSON.stringify(result.rows[0], null, 2));

  await client.end();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
