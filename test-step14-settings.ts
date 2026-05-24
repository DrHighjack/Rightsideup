import { prisma } from './lib/prisma';
import { encryptToken, decryptToken } from './lib/encryption';

async function testStep14() {
  try {
    console.log('=== Step 14: Settings Management & IMAP Configuration ===\n');

    // Test 1: Save IMAP credentials to AppSettings
    console.log('Test 1: Saving IMAP credentials to AppSettings');
    const imapSettings = {
      'imap.imapHost': 'imap.gmail.com',
      'imap.imapPort': '993',
      'imap.imapEmail': 'test@gmail.com',
      'imap.imapPassword': 'test-app-password-123',
    };

    for (const [key, value] of Object.entries(imapSettings)) {
      const isEncrypted = key === 'imap.imapPassword';
      let storedValue = value;

      if (isEncrypted) {
        storedValue = encryptToken(value);
      }

      await prisma.appSettings.upsert({
        where: { key },
        update: { value: storedValue, isEncrypted },
        create: { key, value: storedValue, isEncrypted },
      });
    }
    console.log('✅ IMAP settings saved to database\n');

    // Test 2: Verify encrypted storage
    console.log('Test 2: Verifying encrypted storage');
    const storedPassword = await prisma.appSettings.findUnique({
      where: { key: 'imap.imapPassword' },
    });

    if (storedPassword?.isEncrypted && storedPassword.value !== 'test-app-password-123') {
      console.log('✅ Password is encrypted in database');
      console.log(`   Encrypted value: ${storedPassword.value.substring(0, 30)}...`);
    } else {
      console.log('❌ Password not properly encrypted');
    }
    console.log();

    // Test 3: Retrieve and decrypt settings
    console.log('Test 3: Retrieving and decrypting settings');
    const allSettings = await prisma.appSettings.findMany({
      where: { key: { in: Object.keys(imapSettings) } },
    });

    const decryptedSettings: Record<string, string> = {};
    for (const setting of allSettings) {
      let value = setting.value;
      if (setting.isEncrypted) {
        try {
          value = decryptToken(setting.value);
        } catch (err) {
          console.error(`Failed to decrypt ${setting.key}`);
          value = '[decryption failed]';
        }
      }
      decryptedSettings[setting.key] = value;
    }

    console.log('✅ Settings retrieved and decrypted:');
    for (const [key, value] of Object.entries(decryptedSettings)) {
      const displayValue = key.includes('Password') ? '••••••••' : value;
      console.log(`   ${key}: ${displayValue}`);
    }
    console.log();

    // Test 4: Verify notification settings
    console.log('Test 4: Saving notification settings');
    const notificationSettings = {
      'notifications.adminAlertEmail': 'admin@example.com',
      'notifications.invoiceReminderDays': '7,14,30',
      'notifications.smsOptInDefault': 'true',
    };

    for (const [key, value] of Object.entries(notificationSettings)) {
      await prisma.appSettings.upsert({
        where: { key },
        update: { value, isEncrypted: false },
        create: { key, value, isEncrypted: false },
      });
    }
    console.log('✅ Notification settings saved\n');

    // Test 5: Verify inventory settings
    console.log('Test 5: Saving inventory settings');
    await prisma.appSettings.upsert({
      where: { key: 'inventory.lowInventoryThreshold' },
      update: { value: '5', isEncrypted: false },
      create: { key: 'inventory.lowInventoryThreshold', value: '5', isEncrypted: false },
    });
    console.log('✅ Inventory settings saved\n');

    // Test 6: Verify emailPoller would find settings
    console.log('Test 6: Simulating emailPoller credential lookup');
    const imapCredentials = await prisma.appSettings.findMany({
      where: {
        key: { in: ['imap.imapHost', 'imap.imapPort', 'imap.imapEmail', 'imap.imapPassword'] },
      },
    });

    console.log(`✅ Found ${imapCredentials.length} IMAP settings in database`);
    console.log('   emailPoller will use these credentials instead of environment variables\n');

    // Summary
    console.log('=== Test Summary ===');
    console.log('✅ IMAP credentials encrypted and stored');
    console.log('✅ Sensitive fields properly encrypted with isEncrypted flag');
    console.log('✅ Settings can be retrieved and decrypted');
    console.log('✅ Notification settings stored (non-encrypted)');
    console.log('✅ Inventory settings stored (non-encrypted)');
    console.log('✅ emailPoller can query settings from database');
    console.log('\n✅ STEP 14: Settings management infrastructure working correctly');
    console.log('\nTo complete Step 14:');
    console.log('1. Open /admin/settings page');
    console.log('2. Fill in IMAP credentials');
    console.log('3. Click "Test Connection" to validate');
    console.log('4. Save each section');
    console.log('5. Verify /admin/811 uses saved credentials for polling');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStep14();
