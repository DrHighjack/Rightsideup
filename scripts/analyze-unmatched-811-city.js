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
    const parts = parsedAddress.split(',').map((p) => p.trim()).filter(Boolean);
    const city = parts[1] || '';
    const cityNorm = normalize(city);

    const candidates = await prisma.order.findMany({
      where: city ? { address: { contains: city, mode: 'insensitive' } } : {},
      select: {
        id: true,
        address: true,
        realtorId: true,
        realtor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      take: 10,
    });

    const ranked = candidates
      .map((order) => {
        const addrNorm = normalize(order.address);
        let score = 0;
        if (cityNorm && addrNorm.includes(cityNorm)) score += 100;
        if (addrNorm.includes(' WA ')) score += 5;
        return { ...order, score };
      })
      .sort((a, b) => b.score - a.score);

    console.log(`\nTICKET ${ticketNumber} | ${parsedAddress}`);
    ranked.slice(0, 5).forEach((order) => {
      const realtorLabel = order.realtor
        ? `${order.realtor.email} (${order.realtor.firstName} ${order.realtor.lastName})`
        : order.realtorId || 'unknown';
      console.log(`  ${order.score} | ${order.address} | ${realtorLabel}`);
    });
    if (ranked.length === 0) {
      console.log('  no city candidates');
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
