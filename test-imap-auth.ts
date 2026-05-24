import { ImapFlow } from 'imapflow';

const imapHost = process.env.IMAP_HOST || 'imap.gmail.com';
const imapPort = process.env.IMAP_PORT || '993';
const imapUser = process.env.IMAP_USER || '';
const imapPassword = process.env.IMAP_PASSWORD || '';

console.log('[DEBUG] IMAP Credentials:');
console.log('  Host:', imapHost);
console.log('  Port:', imapPort);
console.log('  User:', imapUser);
console.log('  Pass:', imapPassword ? '***' : '(empty)');

async function testAuth() {
  console.log('\n[TEST] Attempting IMAP authentication...\n');

  // Try 1: Pass credentials in auth object in constructor (CORRECT FORMAT)
  console.log('Attempt 1: Credentials in auth object in constructor');
  try {
    const client1 = new ImapFlow({
      host: imapHost,
      port: parseInt(imapPort, 10),
      secure: true,
      auth: {
        user: imapUser,
        pass: imapPassword,
      },
    } as any);
    await client1.connect();
    console.log('✅ SUCCESS with auth object in constructor\n');
    await client1.logout();
    return;
  } catch (err) {
    console.log('❌ FAILED:', (err as any).message, '\n');
  }

  // Try 2: Pass credentials in auth property before connect
  console.log('Attempt 2: Set auth property before connect()');
  try {
    const client2 = new ImapFlow({
      host: imapHost,
      port: parseInt(imapPort, 10),
      secure: true,
    } as any);
    
    (client2 as any).auth = {
      user: imapUser,
      pass: imapPassword,
    };
    
    await client2.connect();
    console.log('✅ SUCCESS with auth property\n');
    await client2.logout();
    return;
  } catch (err) {
    console.log('❌ FAILED:', (err as any).message, '\n');
  }

  // Try 3: Use login() method after connect
  console.log('Attempt 3: Call login() after connect()');
  try {
    const client3 = new ImapFlow({
      host: imapHost,
      port: parseInt(imapPort, 10),
      secure: true,
    } as any);
    
    await client3.connect();
    console.log('  Connected, now calling login()...');
    
    // Check what methods exist
    console.log('  Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client3)).filter((m: string) => typeof (client3 as any)[m] === 'function').slice(0, 10));
    
    if (typeof (client3 as any).login === 'function') {
      await (client3 as any).login(imapUser, imapPassword);
      console.log('✅ SUCCESS with login() method\n');
      await client3.logout();
      return;
    } else {
      console.log('❌ login() method not found\n');
    }
  } catch (err) {
    console.log('❌ FAILED:', (err as any).message, '\n');
  }

  // Try 4: Try authenticate() method
  console.log('Attempt 4: Call authenticate() method');
  try {
    const client4 = new ImapFlow({
      host: imapHost,
      port: parseInt(imapPort, 10),
      secure: true,
    } as any);
    
    await client4.connect();
    console.log('  Connected, now calling authenticate()...');
    
    if (typeof (client4 as any).authenticate === 'function') {
      await (client4 as any).authenticate({
        user: imapUser,
        pass: imapPassword,
      });
      console.log('✅ SUCCESS with authenticate() method\n');
      await client4.logout();
      return;
    } else {
      console.log('❌ authenticate() method not found\n');
    }
  } catch (err) {
    console.log('❌ FAILED:', (err as any).message, '\n');
  }

  console.log('All attempts failed!');
  process.exit(1);
}

testAuth();
