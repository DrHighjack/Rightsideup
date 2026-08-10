import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify } from "otplib";
import { encryptToken, decryptToken } from "@/lib/encryption";

export interface StoredTwoFactorData {
  secret: string;
  backupCodeHashes: string[];
  pending?: boolean;
  createdAt?: string;
}

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function randomBackupCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (length: number) => {
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  };
  return `${part(4)}-${part(4)}`;
}

export function generateBackupCodes(): string[] {
  const codes = new Set<string>();
  while (codes.size < BACKUP_CODE_COUNT) {
    codes.add(randomBackupCode());
  }
  return Array.from(codes);
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 12)));
}

export async function verifyAndConsumeBackupCode(
  inputCode: string,
  hashes: string[]
): Promise<{ valid: boolean; remainingHashes: string[] }> {
  const normalized = normalizeBackupCode(inputCode);
  if (!normalized) {
    return { valid: false, remainingHashes: hashes };
  }

  for (let i = 0; i < hashes.length; i += 1) {
    const matches = await bcrypt.compare(normalized, hashes[i]);
    if (matches) {
      return {
        valid: true,
        remainingHashes: hashes.filter((_, idx) => idx !== i),
      };
    }
  }

  return { valid: false, remainingHashes: hashes };
}

export function normalizeBackupCode(code: string): string | null {
  const stripped = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (stripped.length !== 8) {
    return null;
  }
  const formatted = `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
  return BACKUP_CODE_REGEX.test(formatted) ? formatted : null;
}

export function serializeTwoFactorData(data: StoredTwoFactorData): string {
  const payload = JSON.stringify(data);
  return encryptToken(payload);
}

export function parseTwoFactorData(encryptedValue: string | null): StoredTwoFactorData | null {
  if (!encryptedValue) {
    return null;
  }

  try {
    const decrypted = decryptToken(encryptedValue);
    const parsed = JSON.parse(decrypted) as StoredTwoFactorData;

    if (
      !parsed ||
      typeof parsed.secret !== "string" ||
      !Array.isArray(parsed.backupCodeHashes)
    ) {
      return null;
    }

    return {
      secret: parsed.secret,
      backupCodeHashes: parsed.backupCodeHashes.filter((h) => typeof h === "string"),
      pending: Boolean(parsed.pending),
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
    };
  } catch {
    return null;
  }
}

export function buildTwoFactorQrUri(email: string, secret: string): string {
  return generateURI({
    issuer: "SignPost Field",
    label: email,
    secret,
  });
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const cleaned = code.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return false;
  }

  const result = await verify({
    strategy: "totp",
    secret,
    token: cleaned,
  });

  return result.valid;
}
