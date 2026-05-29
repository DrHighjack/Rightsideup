#!/usr/bin/env node

/**
 * Import Posts from CSV
 * 
 * This script reads a CSV file with post/installation data and imports them as Orders.
 * 
 * Usage:
 *   node import-posts.js <csv-file>
 * 
 * CSV Format:
 *   address, status, datePosted, notes, clientName, price, latitude, longitude, dateAdded
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim());
  
  // Parse data rows
  const posts = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Handle quoted fields with commas
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    const post = {};
    header.forEach((key, index) => {
      post[key] = values[index] || '';
    });

    posts.push(post);
  }

  return posts;
}

/**
 * Map status from CSV to OrderStatus enum
 */
function mapStatus(csvStatus) {
  const statusMap = {
    'removed': 'CANCELLED',
    'in ground': 'COMPLETED',
    'on hold': 'ON_HOLD',
    'awaiting 811': 'PENDING',
    'awaiting hoa': 'PENDING',
  };

  const normalized = csvStatus.toLowerCase().trim();
  return statusMap[normalized] || 'PENDING';
}

/**
 * Find client by name (fuzzy match)
 */
async function findClientByName(clientName) {
  if (!clientName || !clientName.trim()) return null;

  const cleanName = clientName.trim().toLowerCase();

  // Try exact match first
  const users = await prisma.user.findMany({
    where: { role: 'REALTOR' },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  // First try: exact full name match
  for (const user of users) {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    if (fullName === cleanName) {
      return user;
    }
  }

  // Second try: first name or last name match
  for (const user of users) {
    if (user.firstName.toLowerCase() === cleanName || user.lastName.toLowerCase() === cleanName) {
      return user;
    }
  }

  // Third try: partial match (contains)
  for (const user of users) {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    if (fullName.includes(cleanName) || cleanName.includes(user.firstName.toLowerCase())) {
      return user;
    }
  }

  return null;
}

/**
 * Generate order number
 */
function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * Import posts into database
 */
async function importPosts(filePath) {
  console.log('🚀 Starting Post Import\n');

  try {
    // Parse CSV
    console.log(`📄 Reading CSV file: ${filePath}`);
    const posts = parseCSV(filePath);
    console.log(`✅ Parsed ${posts.length} posts\n`);

    if (posts.length === 0) {
      console.warn('⚠️ No posts found in CSV');
      return;
    }

    // Import each post
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const post of posts) {
      try {
        // Skip if no address or client name
        if (!post.address || !post.clientName) {
          console.log('⏭️  Skipping row: missing address or client name');
          skipped++;
          continue;
        }

        // Find client
        const client = await findClientByName(post.clientName);
        if (!client) {
          console.log(`⏭️  Skipping post for "${post.clientName}" - client not found`);
          skipped++;
          continue;
        }

        // Parse dates
        const datePosted = post.datePosted
          ? new Date(post.datePosted).toISOString()
          : new Date().toISOString();

        // Extract latitude/longitude
        const lat = post.latitude ? parseFloat(post.latitude) : null;
        const lng = post.longitude ? parseFloat(post.longitude) : null;

        // Create order
        const order = await prisma.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            realtorId: client.id,
            type: 'INSTALL',
            status: mapStatus(post.status),
            address: post.address,
            addressLat: lat,
            addressLng: lng,
            notes: post.notes || '',
            createdAt: datePosted,
            updatedAt: datePosted,
          },
        });

        console.log(
          `✅ Imported: "${post.address}" for ${client.firstName} ${client.lastName} - ${post.status}`
        );
        imported++;
      } catch (error) {
        console.error(
          `❌ Error importing post for ${post.clientName} at ${post.address}: ${error.message}`
        );
        errors++;
      }
    }

    console.log(`\n✨ Import Complete!`);
    console.log(`📌 ${imported} posts imported`);
    console.log(`⏭️  ${skipped} posts skipped`);
    if (errors > 0) {
      console.log(`❌ ${errors} errors encountered`);
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get file path from command line arguments
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node import-posts.js <csv-file-path>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

importPosts(filePath);
