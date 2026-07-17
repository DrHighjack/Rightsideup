#!/usr/bin/env node

/**
 * Export Leads to CSV
 * 
 * This script pulls all realtor data from your Google Sheet
 * via the Apps Script API and exports it to a CSV file.
 * 
 * Usage:
 *   node export-leads-to-csv.js
 * 
 * Output: leads-export-[timestamp].csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Apps Script deployment URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxTvQhhia26--tm4hN6PHbX0OUZU87QMRwOlB9oruEHW_WU5cwT9fdWzXXlCg4ldbzJ/exec?action=READ';

/**
 * Fetch leads from Apps Script
 */
async function fetchLeads() {
  console.log('📥 Fetching leads from Google Sheets...');
  
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch leads');
    }

    console.log(`✅ Successfully fetched ${result.leads.length} leads`);
    return result.leads;
  } catch (error) {
    console.error('❌ Error fetching leads:', error.message);
    throw error;
  }
}

/**
 * Escape CSV field values
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value).trim();

  // If the field contains a comma, newline, or double quote, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert leads array to CSV format
 */
function leadsToCSV(leads) {
  if (!leads || leads.length === 0) {
    console.warn('⚠️ No leads to export');
    return '';
  }

  // Get all unique keys from all leads
  const allKeys = new Set();
  leads.forEach(lead => {
    Object.keys(lead).forEach(key => allKeys.add(key));
  });

  const headers = Array.from(allKeys).sort();

  // Create header row
  const headerRow = headers.map(h => escapeCSV(h)).join(',');

  // Create data rows
  const dataRows = leads.map(lead => {
    return headers.map(header => escapeCSV(lead[header])).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Write CSV to file
 */
function writeCSVFile(csv, filename) {
  const filepath = path.join(__dirname, filename);
  
  try {
    fs.writeFileSync(filepath, csv, 'utf-8');
    console.log(`✅ CSV exported to: ${filepath}`);
    console.log(`📊 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    return filepath;
  } catch (error) {
    console.error('❌ Error writing CSV file:', error.message);
    throw error;
  }
}

/**
 * Main export function
 */
async function exportLeadsToCSV() {
  console.log('🚀 Starting Lead Data Export to CSV\n');

  try {
    // Fetch leads
    const leads = await fetchLeads();

    if (leads.length === 0) {
      console.warn('⚠️ No leads found to export');
      return;
    }

    // Convert to CSV
    console.log(`\n📝 Converting ${leads.length} leads to CSV format...`);
    const csv = leadsToCSV(leads);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `leads-export-${timestamp}.csv`;

    // Write to file
    console.log(`💾 Writing to file: ${filename}`);
    const filepath = writeCSVFile(csv, filename);

    // Summary
    console.log('\n✨ Export Complete!');
    console.log(`📌 ${leads.length} leads exported`);
    console.log(`📁 Location: ${filepath}`);
    console.log('\n💡 You can now import this CSV into your new system.');

  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    process.exit(1);
  }
}

// Run the export
exportLeadsToCSV();
