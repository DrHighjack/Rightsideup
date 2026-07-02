import crypto from 'crypto';

// Derive a 32-byte key from the encryption key
function getEncryptionKey(): Buffer {
  const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || process.env.QB_ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error('PAYMENT_ENCRYPTION_KEY (or QB_ENCRYPTION_KEY) environment variable is not set');
  }
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Encrypt a token for secure storage
 */
export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(token, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted token (IV doesn't need to be secret)
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a stored token
 */
export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedToken.split(':');
  
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  
  return decrypted;
}
