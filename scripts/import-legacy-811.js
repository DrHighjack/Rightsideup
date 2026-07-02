require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const LEGACY_NOTE = 'Legacy System - Refer to ticket number on iSite for further info.';

function normalize(s) {
  return (s || '')
    .toUpperCase()
    .replace(/COUNTY/g, '')
    .replace(/\bWA\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildStreetSearchTerms(street) {
  const normalized = normalize(street);
  if (!normalized) return [];

  const tokens = normalized.split(' ').filter(Boolean);
  const terms = new Set();

  terms.add(tokens.join(' '));

  const withoutLeadingHouseNumber = tokens.filter((token, index) => !(index === 0 && /^\d+$/.test(token)));
  if (withoutLeadingHouseNumber.length > 0) {
    terms.add(withoutLeadingHouseNumber.join(' '));
  }

  if (tokens.length > 2) {
    terms.add(tokens.slice(1).join(' '));
    terms.add(tokens.slice(-3).join(' '));
  }

  return Array.from(terms).filter(Boolean);
}

function getAddressParts(parsedAddress) {
  const parts = (parsedAddress || '').split(',').map((p) => p.trim()).filter(Boolean);
  return {
    street: parts[0] || '',
    city: parts[1] || '',
  };
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function scoreOrder(order, ticketDate, streetNorm, cityNorm) {
  const addrNorm = normalize(order.address);
  let score = 0;

  if (streetNorm && addrNorm.includes(streetNorm)) score += 100;
  if (cityNorm && addrNorm.includes(cityNorm)) score += 30;

  const refDate = order.scheduledDate ? new Date(order.scheduledDate) : new Date(order.createdAt);
  const diff = Math.abs(refDate.getTime() - ticketDate.getTime());
  const dayMs = 24 * 60 * 60 * 1000;
  score += Math.max(0, 40 - Math.floor(diff / dayMs));

  return score;
}

async function findBestOrder(ticket) {
  const { street, city } = getAddressParts(ticket.parsedAddress);
  const streetNorm = normalize(street);
  const cityNorm = normalize(city);
  const streetSearchTerms = buildStreetSearchTerms(street);

  if (!streetNorm) return null;

  const streetCandidates = streetSearchTerms.length > 0
    ? streetSearchTerms.map((term) => ({ address: { contains: term, mode: 'insensitive' } }))
    : [{ address: { contains: street, mode: 'insensitive' } }];

  let candidates = await prisma.order.findMany({
    where: {
      OR: streetCandidates,
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      address: true,
      realtorId: true,
      createdAt: true,
      scheduledDate: true,
      ticket811: { select: { id: true, ticketNumber: true } },
    },
  });

  if (city) {
    const withCity = candidates.filter((o) => normalize(o.address).includes(cityNorm));
    if (withCity.length > 0) {
      candidates = withCity;
    }
  }

  if (candidates.length === 0) return null;

  const ticketDate = toDate(ticket.workStartDate) || toDate(ticket.requestedDate) || new Date();

  candidates.sort((a, b) => {
    const aScore = scoreOrder(a, ticketDate, streetNorm, cityNorm);
    const bScore = scoreOrder(b, ticketDate, streetNorm, cityNorm);
    return bScore - aScore;
  });

  return candidates[0];
}

async function upsertTicket(ticket, order) {
  const data = {
    sourceEmail: ticket.sourceEmail || 'legacy-import@rightsignup.local',
    emailSubject: ticket.emailSubject || `811 Ticket #${ticket.ticketNumber}`,
    emailBody: ticket.emailBody || '',
    parsedAddress: ticket.parsedAddress || null,
    workStartDate: toDate(ticket.workStartDate),
    status: 'CLEARED',
    stage: 'CLEAR',
    adminNotes: LEGACY_NOTE,
    requestedDate: toDate(ticket.requestedDate),
    ticketSubmittedAt: toDate(ticket.requestedDate),
    allLinesRespondedAt: toDate(ticket.workStartDate),
    clearanceDate: toDate(ticket.workStartDate),
    clearedAt: new Date(),
    utilityLines: [],
    realtorId: order?.realtorId || null,
    orderId: order?.ticket811 ? null : (order?.id || null),
    matchedOrderIds: order?.id ? [order.id] : [],
  };

  const existing = await prisma.ticket811.findFirst({
    where: { ticketNumber: ticket.ticketNumber },
    select: { id: true },
  });

  if (existing) {
    await prisma.ticket811.update({
      where: { id: existing.id },
      data,
    });
    return { action: 'updated', id: existing.id };
  }

  const created = await prisma.ticket811.create({
    data: {
      ticketNumber: ticket.ticketNumber,
      ...data,
    },
    select: { id: true },
  });

  return { action: 'created', id: created.id };
}

async function main() {
  const dataPath = path.join(__dirname, 'legacy-811-import-data.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing data file: ${dataPath}`);
  }

  const tickets = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(tickets) || tickets.length === 0) {
    throw new Error('legacy-811-import-data.json has no tickets');
  }

  const summary = {
    total: tickets.length,
    created: 0,
    updated: 0,
    matchedToOrder: 0,
    unmatched: 0,
    unmatchedTickets: [],
  };

  for (const ticket of tickets) {
    const order = await findBestOrder(ticket);
    const result = await upsertTicket(ticket, order);

    if (result.action === 'created') summary.created += 1;
    if (result.action === 'updated') summary.updated += 1;

    if (order) {
      summary.matchedToOrder += 1;
      console.log(`✓ ${ticket.ticketNumber} -> order ${order.id} (${order.address})`);
    } else {
      summary.unmatched += 1;
      summary.unmatchedTickets.push(ticket.ticketNumber);
      console.log(`! ${ticket.ticketNumber} -> no matching order found`);
    }
  }

  console.log('\nImport summary');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
