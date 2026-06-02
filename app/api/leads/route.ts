import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get CORS headers based on origin
function getCorsHeaders(origin?: string) {
  const allowedOrigins = [
    'https://northshoresignco.com',
    'https://www.northshoresignco.com',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  // Allow the origin if it's in the list, or allow all for development
  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else {
    corsHeaders['Access-Control-Allow-Origin'] = '*';
  }
  
  return corsHeaders;
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const body = await request.json();
    
    const { fullName, phone, email, brokerage } = body;
    
    // Validate required fields
    if (!fullName || !phone || !email || !brokerage) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, phone, email, brokerage' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Create the instaads lead in database
    const lead = await prisma.instaads.create({
      data: {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.toLowerCase().trim(),
        brokerage: brokerage.trim(),
      },
    });
    
    // Log the submission
    console.log('[LEADS API] New Instaads lead created:', {
      id: lead.id,
      email: lead.email,
      fullName: lead.fullName,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: true,
        message: 'Lead submitted successfully',
        leadId: lead.id,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[LEADS API] Error creating lead:', error);
    
    // Capture error in Sentry if configured
    if (process.env.SENTRY_DSN) {
      const Sentry = await import('@sentry/nextjs').then(m => m.default);
      Sentry.captureException(error, {
        contexts: {
          api: {
            route: 'POST /api/leads',
            type: 'lead_submission',
          },
        },
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to submit lead. Please try again.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
