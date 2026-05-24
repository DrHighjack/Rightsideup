import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all settings
    const allSettings = await prisma.appSettings.findMany();

    // Convert to key-value object and decrypt sensitive fields
    const settings: Record<string, any> = {};
    for (const setting of allSettings) {
      let value: any = setting.value;

      // Decrypt encrypted fields
      if (setting.isEncrypted) {
        try {
          value = decryptToken(setting.value);
        } catch (err) {
          console.error(`Failed to decrypt setting ${setting.key}:`, err);
          value = '';
        }
      } else {
        // Parse JSON values if applicable
        try {
          value = JSON.parse(setting.value);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      settings[setting.key] = value;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { section, settings } = body;

    if (!section || !settings) {
      return NextResponse.json(
        { error: 'Missing section or settings' },
        { status: 400 }
      );
    }

    // Define which fields are encrypted per section
    const encryptedFields: Record<string, string[]> = {
      imap: ['imapPassword'],
    };

    const sectionEncryptedFields = encryptedFields[section] || [];

    // Save each setting
    for (const [key, value] of Object.entries(settings)) {
      const settingKey = `${section}.${key}`;
      let settingValue = typeof value === 'string' ? value : JSON.stringify(value);
      const isEncrypted = sectionEncryptedFields.includes(key);

      // Encrypt if needed
      if (isEncrypted && settingValue) {
        settingValue = encryptToken(settingValue);
      }

      // Upsert setting
      await prisma.appSettings.upsert({
        where: { key: settingKey },
        update: { value: settingValue, isEncrypted },
        create: { key: settingKey, value: settingValue, isEncrypted },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
