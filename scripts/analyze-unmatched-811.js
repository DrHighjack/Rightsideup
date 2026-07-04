require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tickets = [
  ['26284736', 'S 129TH ST, BURIEN, KING COUNTY, WA'],
  ['26278004', '103 N CHESTNUT ST, ELLENSBURG, KITTITAS COUNTY, WA'],
  ['26277817', 'BULLFROG RD, CLE ELUM, KITTITAS COUNTY, WA'],
  ['26277812', '1095 WOOD DUCK RD, CLE ELUM, KITTITAS COUNTY, WA'],
  ['26267675', 'MILITARY RD S, SEATAC, KING COUNTY, WA'],
  ['26243145', 'SE 190TH ST, RENTON, KING COUNTY, WA'],
  ['26221769', '13311 3RD AVENUE CT NW, MAPLEWOOD, PIERCE COUNTY, WA'],
  ['26164276', '17312 40TH AVE SE, MILL CREEK EAST, SNOHOMISH COUNTY, WA'],
  ['26096031', 'EBBERT DR SE, BETHEL, KITSAP COUNTY, WA'],
];

function normalize(text) {
  return (text || '')
    .toUpperCase()
    .replace(/COUNTY/g, '')
    .replace(/\bWA\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  for (const [ticketNumber, parsedAddress] of tickets) {
    const street = parsedAddress.split(',')[0].trim();
    const streetNorm = normalize(street);
    const cityNorm = normalize(parsedAddress.split(',')[1] || '');

    const candidates = await prisma.order.findMany({
      where: {
        OR: [
          { address: { contains: street, mode: 'insensitive' } },
          { address: { contains: streetNorm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        address: true,
        realtorId: true,
        realtor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      take: 20,
    });

    const ranked = candidates
      .map((order) => {
        const addrNorm = normalize(order.address);
        let score = 0;
        if (addrNorm.includes(streetNorm)) score += 100;
        if (cityNorm && addrNorm.includes(cityNorm)) score += 20;
        if (addrNorm.includes(' WA ')) score += 5;
        return { ...order, score };
      })
      .sort((a, b) => b.score - a.score);

    console.log(`\nTICKET ${ticketNumber} | ${parsedAddress}`);
    if (ranked.length === 0) {
      console.log('  no candidates');
      continue;
    }

    ranked.slice(0, 5).forEach((order) => {
      const realtorLabel = order.realtor
        ? `${order.realtor.email} (${order.realtor.firstName} ${order.realtor.lastName})`
        : order.realtorId || 'unknown';
      console.log(`  ${order.score} | ${order.address} | ${realtorLabel}`);
    });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
