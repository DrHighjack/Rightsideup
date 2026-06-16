#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function mapStatus(csvStatus) {
  const statusMap = {
    Removed: 'COMPLETED',
    'In Ground': 'IN_GROUND',
    'On Hold': 'ON_HOLD',
    'Awaiting 811': 'PENDING',
    'Awaiting HOA': 'ON_HOLD',
  };
  return statusMap[csvStatus] || 'PENDING';
}

function parseDate(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function ensureRealtor(fullName, emailHint) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || 'Unknown';
  const lastName = parts.slice(1).join(' ') || 'Agent';

  let email = emailHint;
  if (!email) {
    email = `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '')}@northshoresignco.local`;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'REALTOR',
    },
  });
}

async function upsertOrder(row, realtorId) {
  const existing = await prisma.order.findFirst({
    where: {
      realtorId,
      address: row.address,
      notes: row.notes || '',
    },
    select: { id: true },
  });

  if (existing) return false;

  await prisma.order.create({
    data: {
      orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      realtorId,
      type: 'INSTALL',
      status: mapStatus(row.status),
      address: row.address,
      addressLat: row.latitude,
      addressLng: row.longitude,
      notes: row.notes || '',
      createdAt: parseDate(row.datePosted),
      updatedAt: parseDate(row.datePosted),
    },
  });

  return true;
}

async function main() {
  const satya = await ensureRealtor('Satya Delgadillo');
  const nssc = await ensureRealtor('North Shore Sign Co.');

  const rows = [
    {
      address: '8801 204th St SW, Edmonds, WA 98026',
      status: 'In Ground',
      datePosted: '5/1/2026',
      notes: '8801 204th St SW, Edmonds, WA 98026',
      latitude: 47.8146933,
      longitude: -122.3524958,
      realtorId: nssc.id,
    },
    {
      address: '6119 Sehmel Dr NW, Gig Harbor, WA 98332',
      status: 'Awaiting 811',
      datePosted: '6/1/2026',
      notes: '',
      latitude: 47.353479,
      longitude: -122.6204683,
      realtorId: satya.id,
    },
    {
      address: '546 Kingsway W, Bremerton, WA 98312',
      status: 'Awaiting 811',
      datePosted: '6/1/2026',
      notes: '(1/2)Vacant Lot, addy is next to listed since no address',
      latitude: 47.560494,
      longitude: -122.8367946,
      realtorId: satya.id,
    },
    {
      address: '546 Kingsway W, Bremerton, WA 98312',
      status: 'Awaiting 811',
      datePosted: '6/1/2026',
      notes: '(2/2)Vacant Lot, addy is next to listed since no address',
      latitude: 47.560494,
      longitude: -122.8367946,
      realtorId: satya.id,
    },
  ];

  let created = 0;
  for (const row of rows) {
    const wasCreated = await upsertOrder(row, row.realtorId);
    if (wasCreated) created++;
  }

  console.log(`Missing rows import complete: ${created} created, ${rows.length - created} already existed`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });