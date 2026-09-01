#!/usr/bin/env node

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.trim() !== '')) {
      rows.push(row);
    }
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] || '').trim();
    });
    return obj;
  });
}

function clean(value) {
  const v = (value || '').trim();
  if (!v || v.toLowerCase() === 'undefined') return null;
  return v;
}

function parseDate(value) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildNotes(lead) {
  const notes = [];

  const rawNotes = clean(lead['Notes']);
  if (rawNotes) notes.push(rawNotes);

  const interactionCount = clean(lead['Interaction Count']);
  if (interactionCount) notes.push(`Interaction Count: ${interactionCount}`);

  const verification = clean(lead['Verification Status']);
  if (verification) notes.push(`Verification Status: ${verification}`);

  const insta = clean(lead['Instagram Handle']);
  if (insta) notes.push(`Instagram: ${insta}`);

  const years = clean(lead['Years in Business']);
  if (years) notes.push(`Years in Business: ${years}`);

  return notes.length ? notes.join(' | ') : null;
}

function mapStatus(lead) {
  const verification = (clean(lead['Verification Status']) || '').toLowerCase();
  if (verification === 'verified') return 'CONTACTED';
  return 'NEW';
}

async function importLeads(filePath) {
  const csv = fs.readFileSync(filePath, 'utf-8');
  const leads = parseCsv(csv);

  console.log(`Parsed ${leads.length} lead rows from ${filePath}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    const fullName = clean(lead['Name']);
    if (!fullName) {
      skipped++;
      continue;
    }

    const phone = clean(lead['Phone']) || '';
    const email = clean(lead['Email']) || `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '')}@lead.local`;
    const brokerage = clean(lead['Brokerage']) || 'Unknown';
    const notes = buildNotes(lead);
    const followUpDate = parseDate(lead['Date Followed']);
    const status = mapStatus(lead);

    const existing = await prisma.instaads.findFirst({
      where: {
        OR: [
          { email },
          { AND: [{ fullName }, { phone }] },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.instaads.update({
        where: { id: existing.id },
        data: {
          fullName,
          phone,
          email,
          brokerage,
          notes,
          followUpDate,
          status,
          lastContactedAt: followUpDate,
        },
      });
      updated++;
    } else {
      await prisma.instaads.create({
        data: {
          fullName,
          phone,
          email,
          brokerage,
          notes,
          followUpDate,
          status,
          lastContactedAt: followUpDate,
        },
      });
      imported++;
    }
  }

  console.log(`Leads import complete: ${imported} created, ${updated} updated, ${skipped} skipped`);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node import-leads.js <csv-file-path>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

importLeads(filePath)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });