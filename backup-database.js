const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = 'postgresql://postgres:EWNCLGCexmYgWMkFRBHOismSLPPbxbcV@kodama.proxy.rlwy.net:51896/railway';

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function backupDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const backupFile = path.join(backupDir, `RightSignUP_backup_${timestamp}.sql`);
    const backupStream = fs.createWriteStream(backupFile);

    // Get all tables
    console.log('📋 Fetching table list...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`📊 Found ${tables.length} tables`);

    // Write header
    backupStream.write(`-- RightSignUP Database Backup\n`);
    backupStream.write(`-- Generated: ${new Date().toISOString()}\n`);
    backupStream.write(`-- Database: railway\n`);
    backupStream.write(`-- Tables: ${tables.length}\n\n`);

    // Backup schema
    console.log('🏗️  Backing up schema...');
    const schemaResult = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    backupStream.write('-- SCHEMA DEFINITION\n\n');
    for (const table of tables) {
      const columns = schemaResult.rows.filter(row => row.table_name === table);
      if (columns.length > 0) {
        backupStream.write(`-- Table: ${table}\n`);
        backupStream.write(`CREATE TABLE IF NOT EXISTS ${table} (\n`);
        backupStream.write(
          columns
            .map((col, idx) => {
              let def = `  ${col.column_name} ${col.data_type}`;
              if (col.column_default) def += ` DEFAULT ${col.column_default}`;
              if (col.is_nullable === 'NO') def += ' NOT NULL';
              return def;
            })
            .join(',\n')
        );
        backupStream.write('\n);\n\n');
      }
    }

    // Backup data
    console.log('💾 Backing up data...');
    backupStream.write('-- DATA\n\n');

    let totalRows = 0;
    for (const table of tables) {
      process.stdout.write(`  Exporting ${table}... `);
      const result = await client.query(`SELECT * FROM ${table}`);
      const rows = result.rows;
      totalRows += rows.length;

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        for (const row of rows) {
          const values = columns
            .map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'boolean') return val ? 'true' : 'false';
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return String(val);
            })
            .join(', ');
          backupStream.write(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values});\n`);
        }
      }
      console.log(`✅ (${rows.length} rows)`);
    }

    backupStream.end();
    await new Promise((resolve, reject) => {
      backupStream.on('finish', resolve);
      backupStream.on('error', reject);
    });

    console.log(`\n✅ Backup complete!`);
    console.log(`📁 Location: ${backupFile}`);
    console.log(`📊 Statistics:`);
    console.log(`   - Tables: ${tables.length}`);
    console.log(`   - Total Rows: ${totalRows}`);
    console.log(`   - File Size: ${fs.statSync(backupFile).size} bytes`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

backupDatabase();
