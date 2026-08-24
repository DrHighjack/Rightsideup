#!/usr/bin/env node

const { randomBytes } = require("crypto");
const { readFileSync } = require("fs");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const OFFICE_NAMES = {
  anacortes: "Windermere - Anacortes",
  arlington: "Windermere Alrlington",
  "north cascades": "Windermere - North Cascades",
  skagit: "Windermere - Skagit Valley",
  "skagit valley": "Windermere - Skagit Valley",
};

function parseRows(csv) {
  const rows = [];
  let propertyManagerSection = false;

  csv.split(/\r?\n/).slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const [name = "", officeLabel = "", phone = "", emailCell = ""] = line
      .split(",")
      .map((value) => value.trim());

    if (name.toLowerCase() === "property managers") {
      propertyManagerSection = true;
      return;
    }
    if (!name && !officeLabel && !phone && !emailCell) return;

    const email = emailCell.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase();
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (!email || nameParts.length < 2 || !officeLabel) {
      throw new Error(`Row ${rowNumber} is missing a valid name, office, or email`);
    }

    rows.push({
      rowNumber,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" "),
      officeLabel,
      phone,
      email,
      propertyManager: propertyManagerSection,
    });
  });

  return rows;
}

function temporaryPassword() {
  return `${randomBytes(24).toString("base64url")}aA1!`;
}

async function requestOnboardingEmail(email) {
  const response = await fetch("https://app.northshoresignco.com/api/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error(`Onboarding request returned HTTP ${response.status}`);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const csvPath = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  if (!csvPath) {
    throw new Error("Usage: node scripts/import-windermere-accounts.js <csv-path> [--apply]");
  }

  const rows = parseRows(readFileSync(csvPath, "utf8"));
  const uniqueEmails = new Set(rows.map((row) => row.email));
  if (uniqueEmails.size !== rows.length) throw new Error("CSV contains duplicate email addresses");

  const requiredOfficeNames = [...new Set(rows.map((row) => OFFICE_NAMES[row.officeLabel.toLowerCase()]))];
  if (requiredOfficeNames.some((name) => !name)) {
    const unknown = [...new Set(rows.filter((row) => !OFFICE_NAMES[row.officeLabel.toLowerCase()]).map((row) => row.officeLabel))];
    throw new Error(`Unknown office labels: ${unknown.join(", ")}`);
  }

  const offices = await prisma.brokerage.findMany({
    where: { name: { in: requiredOfficeNames }, isActive: true },
    select: { id: true, name: true },
  });
  const officesByName = new Map(offices.map((office) => [office.name, office]));
  const missingOffices = requiredOfficeNames.filter((name) => !officesByName.has(name));
  if (missingOffices.length) throw new Error(`Active offices not found: ${missingOffices.join(", ")}`);

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: [...uniqueEmails], mode: "insensitive" } },
    select: { email: true, role: true },
  });
  const existingByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]));
  const propertyManagers = rows.filter((row) => row.propertyManager);

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${rows.length} accounts from ${offices.length} offices`);
  for (const officeName of requiredOfficeNames) {
    const officeRows = rows.filter((row) => OFFICE_NAMES[row.officeLabel.toLowerCase()] === officeName);
    console.log(`- ${officeName}: ${officeRows.filter((row) => !row.propertyManager).length} realtors, ${officeRows.filter((row) => row.propertyManager).length} property managers`);
  }
  for (const existing of existingUsers) {
    console.log(`- SKIP existing ${existing.email} (${existing.role})`);
  }
  if (!apply) {
    console.log(`Would create ${rows.length - existingUsers.length} accounts and link ${propertyManagers.length} property managers.`);
    return;
  }

  let created = 0;
  let onboardingEmailsRequested = 0;
  let failed = 0;

  for (const row of rows) {
    if (existingByEmail.has(row.email)) continue;
    const office = officesByName.get(OFFICE_NAMES[row.officeLabel.toLowerCase()]);

    try {
      const user = await prisma.user.create({
        data: {
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone || null,
          passwordHash: await bcrypt.hash(temporaryPassword(), 12),
          role: row.propertyManager ? "TC" : "REALTOR",
          tags: row.propertyManager ? ["PROPERTY_MANAGER"] : [],
          brokerageId: office.id,
          paymentMethod: "OFFICE",
        },
      });
      created += 1;
      existingByEmail.set(row.email, { email: user.email, role: user.role });

      try {
        await requestOnboardingEmail(user.email);
        onboardingEmailsRequested += 1;
      } catch (error) {
        console.error(`Onboarding email request failed for ${row.email}:`, error.message);
      }
    } catch (error) {
      failed += 1;
      console.error(`Account creation failed for row ${row.rowNumber} (${row.email}):`, error.message);
    }
  }

  let linksCreated = 0;
  for (const row of propertyManagers) {
    const office = officesByName.get(OFFICE_NAMES[row.officeLabel.toLowerCase()]);
    const manager = await prisma.user.findFirst({
      where: { email: { equals: row.email, mode: "insensitive" }, role: "TC" },
      select: { id: true, tags: true },
    });
    if (!manager) {
      failed += 1;
      console.error(`Cannot link ${row.email}: TC account was not found`);
      continue;
    }
    if (!manager.tags.includes("PROPERTY_MANAGER")) {
      await prisma.user.update({
        where: { id: manager.id },
        data: { tags: { push: "PROPERTY_MANAGER" }, brokerageId: office.id },
      });
    }

    const agents = await prisma.user.findMany({
      where: { brokerageId: office.id, role: "REALTOR" },
      select: { id: true },
    });
    const linkResult = await prisma.tCAgentLink.createMany({
      data: agents.map((agent) => ({
        tcUserId: manager.id,
        agentUserId: agent.id,
        grantedBy: "ADMIN",
      })),
      skipDuplicates: true,
    });
    linksCreated += linkResult.count;
  }

  console.log(`Created ${created} accounts; requested ${onboardingEmailsRequested} onboarding emails; created ${linksCreated} property-manager links; ${failed} failures.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());