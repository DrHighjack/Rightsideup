import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { imapHost, imapPort, imapEmail, imapPassword } = body;

    if (!imapHost || !imapPort || !imapEmail || !imapPassword) {
      return NextResponse.json(
        { error: 'Missing required IMAP fields' },
        { status: 400 }
      );
    }

    // Dynamically import ImapFlow to avoid webpack bundling issues
    const { ImapFlow } = await import('imapflow');

    // Test IMAP connection
    const client = new ImapFlow({
      host: imapHost,
      port: parseInt(imapPort),
      secure: parseInt(imapPort) === 993,
      auth: {
        user: imapEmail,
        pass: imapPassword,
      },
    });

    try {
      await client.connect();
      console.log('[SETTINGS] IMAP connection successful');
      await client.close();

      return NextResponse.json({
        success: true,
        message: 'IMAP connection successful',
      });
    } catch (err) {
      console.error('[SETTINGS] IMAP connection failed:', err);
      return NextResponse.json(
        {
          success: false,
          message: `IMAP connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Test IMAP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
