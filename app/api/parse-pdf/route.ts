import { NextRequest, NextResponse } from 'next/server';

interface ExtractedData {
  ticketNumber?: string;
  sourceEmail?: string;
  emailSubject?: string;
  parsedAddress?: string;
  workStartDate?: string;
  utilityLines?: Array<{ name: string; status: string }>;
  coordinates?: { lat: number; lng: number };
}

/**
 * Extract text from PDF buffer using pdf-parse
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamically import PDFParse to handle ESM module
    const pdfParse = await import('pdf-parse');
    const PDFParse = (pdfParse as any).default || pdfParse;
    const data = await PDFParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw error;
  }
}

/**
 * Parse 811 PDF and extract relevant data
 */
function parse811PDFText(text: string, fileName: string): ExtractedData {
  const data: ExtractedData = {};

  // Extract ticket number
  let ticketMatch = text.match(/(?:ticket\s*#?|ticket\s+number|locate\s+number|811[\s-]?\d+|request\s+#)[:\s]*([A-Z0-9\-]{5,20})/i);
  if (ticketMatch) {
    data.ticketNumber = ticketMatch[1].trim();
  } else {
    ticketMatch = text.match(/([A-Z]{2}\d{6,10})/);
    if (ticketMatch) {
      data.ticketNumber = ticketMatch[1].trim();
    }
  }

  // Extract email addresses
  const emailMatches = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
  if (emailMatches && emailMatches.length > 0) {
    data.sourceEmail =
      emailMatches.find((e) => !e.includes('noreply') && !e.includes('notification')) ||
      emailMatches[0];
  }

  // Extract address
  let addressMatch = text.match(
    /(\d+\s+[A-Za-z\s\.]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway)[.,\s]+[A-Za-z\s]+[,\s]+(?:[A-Z]{2})?[,\s]*\d{0,5})/i
  );
  if (addressMatch) {
    data.parsedAddress = addressMatch[1].trim();
  } else {
    addressMatch = text.match(/(?:address|location)[:\s]*([^\n]{20,80})/i);
    if (addressMatch) {
      data.parsedAddress = addressMatch[1].trim();
    }
  }

  // Extract coordinates
  let coordMatch = text.match(/latitude[:\s]*(-?\d+\.\d+).*longitude[:\s]*(-?\d+\.\d+)/i);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      data.coordinates = { lat, lng };
    }
  } else {
    coordMatch = text.match(/(\d+\.\d+)\s*[,\s]+\s*(-?\d+\.\d+)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        data.coordinates = { lat, lng };
      }
    }
  }

  // Extract date
  let dateMatch = text.match(/(?:date|start|request)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i);
  if (dateMatch) {
    data.workStartDate = dateMatch[1];
  }

  // Extract utility companies
  const utilityPatterns: Record<string, string[]> = {
    'Electric': ['electric', 'power', 'electricity', 'edp', 'eel'],
    'Gas': ['gas', 'natural gas', 'propane'],
    'Water': ['water', 'municipal water'],
    'Sewer': ['sewer', 'wastewater'],
    'Cable': ['cable', 'catv'],
    'Telephone': ['telephone', 'phone'],
    'Fiber': ['fiber', 'fiber optic'],
  };

  const utilityLines: Map<string, { name: string; status: string }> = new Map();
  const lines = text.split('\n');

  lines.forEach((line, idx) => {
    Object.entries(utilityPatterns).forEach(([utilityName, patterns]) => {
      patterns.forEach((pattern) => {
        if (line.toLowerCase().includes(pattern)) {
          let status = 'PENDING';
          const contextLines = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join(' ').toLowerCase();

          if (/responded|locate|located|marked/.test(contextLines)) {
            status = 'RESPONDED';
          }
          if (/clear|no conflict|cleared/.test(contextLines)) {
            status = 'CLEAR';
          }
          if (/conflict|crossed|damage/.test(contextLines)) {
            status = 'CONFLICT';
          }

          utilityLines.set(utilityName, { name: utilityName, status });
        }
      });
    });
  });

  if (utilityLines.size > 0) {
    data.utilityLines = Array.from(utilityLines.values());
  }

  // Extract email subject
  if (!data.emailSubject) {
    let subjectMatch = text.match(/(?:subject|re|fwd|fw)[:\s]*([^\n]{10,100})/i);
    if (subjectMatch) {
      data.emailSubject = subjectMatch[1].trim();
    } else {
      data.emailSubject = `811 Locate Request - ${fileName.replace('.pdf', '')}`;
    }
  }

  return data;
}

/**
 * POST /api/parse-pdf
 * Parse a PDF file and extract 811 ticket information
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text from PDF
    const text = await extractTextFromPDF(buffer);

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'No text could be extracted from PDF',
          data: {
            emailSubject: `811 Locate Request - ${file.name.replace('.pdf', '')}`,
          },
        },
        { status: 400 }
      );
    }

    // Parse extracted text
    const extractedData = parse811PDFText(text, file.name);

    console.log('Extracted data from PDF:', extractedData);

    return NextResponse.json({ success: true, data: extractedData });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
