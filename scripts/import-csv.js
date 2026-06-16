#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Simple CSV parser
function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const row = {};
    let current = '';
    let insideQuotes = false;
    let colIndex = 0;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      const nextChar = lines[i][j + 1];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        row[headers[colIndex]] = current.trim().replace(/"/g, '');
        current = '';
        colIndex++;
      } else {
        current += char;
      }
    }
    row[headers[colIndex]] = current.trim().replace(/"/g, '');
    rows.push(row);
  }

  return rows;
}

async function importClients() {
  console.log('\n📥 Importing Clients...');
  const filePath = path.join(process.env.USERPROFILE, 'Downloads', 'Sheets Backend - Clients.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Clients file not found:', filePath);
    return;
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const clients = parseCSV(csvContent);

  let importedCount = 0;
  let skippedCount = 0;

  for (const client of clients) {
    if (!client['Client Name'] || !client['Client Name'].trim()) {
      skippedCount++;
      continue;
    }

    try {
      // Check if user already exists by email
      const email = client['Email']?.trim();
      let existingUser = null;

      if (email) {
        existingUser = await prisma.user.findUnique({
          where: { email }
        });
      }

      if (existingUser) {
        console.log(`  ⏭️  Skipping ${client['Client Name']} (already exists with email ${email})`);
        skippedCount++;
        continue;
      }

      const nameParts = client['Client Name'].split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || 'Agent';

      const user = await prisma.user.create({
        data: {
          email: email || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}@northshoresignco.com`,
          firstName,
          lastName,
          phone: client['Phone']?.trim() || null,
          role: 'REALTOR',
          passwordHash: '', // Will need to set password manually or reset
        }
      });

      console.log(`  ✅ Created ${client['Client Name']} (${user.id})`);
      importedCount++;
    } catch (error) {
      console.error(`  ❌ Error importing ${client['Client Name']}:`, error.message);
    }
  }

  console.log(`\n📊 Clients: ${importedCount} imported, ${skippedCount} skipped, ${clients.length} total`);
}

async function importPosts() {
  console.log('\n📥 Importing Posts/Orders...');
  const filePath = path.join(process.env.USERPROFILE, 'Downloads', 'Sheets Backend - Post.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Posts file not found:', filePath);
    return;
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const posts = parseCSV(csvContent);

  let importedCount = 0;
  let skippedCount = 0;

  for (const post of posts) {
    if (!post['address'] || !post['address'].trim()) {
      skippedCount++;
      continue;
    }

    try {
      const clientName = post['clientName']?.trim();
      
      // Find the realtor by name
      let realtorId = null;
      if (clientName) {
        const nameParts = clientName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        const realtor = await prisma.user.findFirst({
          where: {
            AND: [
              { firstName: { equals: firstName, mode: 'insensitive' } },
              lastName ? { lastName: { equals: lastName, mode: 'insensitive' } } : {}
            ]
          }
        });

        if (realtor) {
          realtorId = realtor.id;
        } else {
          console.log(`  ⚠️  Client not found: ${clientName}`);
          skippedCount++;
          continue;
        }
      }

      const statusMap = {
        'Removed': 'COMPLETED',
        'In Ground': 'IN_GROUND',
        'On Hold': 'ON_HOLD',
        'Awaiting 811': 'PENDING',
        'Awaiting HOA': 'ON_HOLD'
      };

      const status = statusMap[post['status']] || 'PENDING';

      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          realtorId: realtorId || '0', // Fallback if no realtor found
          address: post['address'],
          addressLat: post['latitude'] ? parseFloat(post['latitude']) : null,
          addressLng: post['longitude'] ? parseFloat(post['longitude']) : null,
          type: 'INSTALL',
          status,
          notes: post['notes']?.trim() || null,
          createdAt: post['datePosted'] ? new Date(post['datePosted']) : new Date()
        }
      });

      console.log(`  ✅ Created order for ${post['address']}`);
      importedCount++;
    } catch (error) {
      console.error(`  ❌ Error importing post at ${post['address']}:`, error.message);
    }
  }

  console.log(`\n📊 Posts/Orders: ${importedCount} imported, ${skippedCount} skipped, ${posts.length} total`);
}

async function importAdData() {
  console.log('\n📥 Importing Ad Campaign Data...');
  const filePath = path.join(process.env.USERPROFILE, 'Downloads', 'North-Shore-Sign-Co-Ad-sets-Apr-29-2026-May-28-2026.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Ad data file not found:', filePath);
    return;
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const adSets = parseCSV(csvContent);

  console.log(`\n📊 Ad Campaign Data (for reference):`);
  for (const ad of adSets) {
    console.log(`  📱 ${ad['Ad set name']}`);
    console.log(`     Status: ${ad['Ad set delivery']}`);
    console.log(`     Results: ${ad['Results']} ${ad['Result indicator']}`);
    console.log(`     Spent: $${ad['Amount spent (USD)']}`);
    console.log(`     Impressions: ${ad['Impressions']}`);
    console.log(`     Reach: ${ad['Reach']}`);
    console.log(`     Period: ${ad['Reporting starts']} to ${ad['Reporting ends']}`);
  }

  console.log(`\n💡 Ad campaign data imported to logs. Create tracking table if needed for long-term analytics.`);
}

async function main() {
  try {
    console.log('🚀 Starting CSV Import...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await importClients();
    await importPosts();
    await importAdData();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Import complete!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
