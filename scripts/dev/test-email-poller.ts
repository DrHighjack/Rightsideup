import { connectAndFetch } from '../../lib/emailPoller';

async function testEmailPoller() {
  console.log('[TEST] Starting IMAP email fetcher test...\n');
  try {
    const emails = await connectAndFetch();
    console.log(`\n[TEST] ✅ Success! Fetched ${emails.length} email(s):\n`);
    emails.forEach((email, index) => {
      console.log(`📧 Email ${index + 1}:`);
      console.log(`   Subject: ${email.subject}`);
      console.log(`   From: ${email.from}`);
      console.log(`   Date: ${email.date}`);
      console.log(`   UID: ${email.uid}`);
      console.log(`   Body length: ${email.body.length} bytes\n`);
    });
  } catch (error) {
    console.error('[TEST] ❌ Error:', error);
    process.exit(1);
  }
}

testEmailPoller();
