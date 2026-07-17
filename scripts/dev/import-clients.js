#!/usr/bin/env node

/**
 * Import Clients from CSV
 * 
 * This script reads a CSV file with client data and imports them into the database.
 * 
 * Usage:
 *   node import-clients.js <csv-file>
 * 
 * CSV Format:
 *   Client Name, Phone, Email, Closed By (person's name who closed), Paid Install (Yes/No), 
 *   Free Install (Yes/No), Date Added, Notes, Price, Amount of Posts, Pending Invoice
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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
  const clients = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = line.split(',').map(v => v.trim());
    const client = {};
    
    header.forEach((key, index) => {
      client[key] = values[index] || '';
    });

    clients.push(client);
  }

  return clients;
}

/**
 * Parse client data into User format
 */
function formatClientData(client) {
  const [firstName, ...lastNameParts] = client['Client Name'].split(' ');
  const lastName = lastNameParts.join(' ') || '';
  
  // Create email if not provided
  let email = client['Email'] || '';
  if (!email) {
    // Generate a placeholder email
    const namePart = client['Client Name'].toLowerCase().replace(/\s+/g, '.');
    email = `${namePart}@northshoresignco.local`;
  }

  // Parse dates
  const dateAdded = client['Date Added'] ? new Date(client['Date Added']).toISOString() : new Date().toISOString();

  // Store installation and pricing info in adminNotes as JSON
  const adminNotes = [
    {
      text: `Import Data: Paid Install: ${client['Paid Install (Yes/No)']}, Free Install: ${client['Free Install (Yes/No)']}, Price: ${client['Price']}, Posts: ${client['Amount of Posts']}, Pending Invoice: ${client['Pending Invoice']}, Closed By: ${client['Closed By (person\'s name who closed)']}, Notes: ${client['Notes']}`,
      createdAt: new Date().toISOString(),
      adminId: 'system-import'
    }
  ];

  return {
    email,
    firstName,
    lastName,
    phone: client['Phone'] || '',
    role: 'REALTOR',
    brokerageName: '',
    paymentMethod: client['Paid Install (Yes/No)'] === 'Yes' ? 'Office Pays' : 'N/A',
    tags: client['Free Install (Yes/No)'] === 'Yes' ? ['Free Install'] : [],
    adminNotes: JSON.stringify(adminNotes),
    createdAt: new Date(dateAdded),
  };
}

/**
 * Import clients into database
 */
async function importClients(filePath) {
  console.log('🚀 Starting Client Import\n');

  try {
    // Parse CSV
    console.log(`📄 Reading CSV file: ${filePath}`);
    const clients = parseCSV(filePath);
    console.log(`✅ Parsed ${clients.length} clients\n`);

    if (clients.length === 0) {
      console.warn('⚠️ No clients found in CSV');
      return;
    }

    // Import each client
    let imported = 0;
    let skipped = 0;

    for (const client of clients) {
      try {
        // Skip if no client name
        if (!client['Client Name']) {
          console.log('⏭️  Skipping row with no client name');
          skipped++;
          continue;
        }

        const userData = formatClientData(client);

        // Check if user already exists
        const existing = await prisma.user.findUnique({
          where: { email: userData.email },
        });

        if (existing) {
          console.log(`⏭️  Skipping ${client['Client Name']} (email already exists)`);
          skipped++;
          continue;
        }

        // Generate a temporary password
        const tempPassword = Math.random().toString(36).substring(2, 15);
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        // Create user
        await prisma.user.create({
          data: {
            ...userData,
            passwordHash,
          },
        });

        console.log(`✅ Imported: ${client['Client Name']} (${userData.email})`);
        imported++;

      } catch (error) {
        console.error(`❌ Error importing ${client['Client Name']}: ${error.message}`);
      }
    }

    console.log(`\n✨ Import Complete!`);
    console.log(`📌 ${imported} clients imported`);
    console.log(`⏭️  ${skipped} clients skipped`);
    console.log(`\n💡 All clients are set up as REALTOR role with temporary passwords.`);
    console.log(`💡 Installation details stored in admin notes.`);

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
  console.error('Usage: node import-clients.js <csv-file-path>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`❌ File not found: ${filePath}`);
  process.exit(1);
}

importClients(filePath);
