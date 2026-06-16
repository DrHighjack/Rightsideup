import * as pdfjsLib from 'pdfjs-dist';

// Set worker with a reliable CDN URL
if (typeof window !== 'undefined') {
  // Use unpkg CDN which is more reliable
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

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
 * Extract text from PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ');
        text += pageText + '\n';
      } catch (pageError) {
        console.warn(`Error extracting page ${i}:`, pageError);
      }
    }

    return text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw error;
  }
}

/**
 * Parse 811 PDF and extract relevant data
 */
export async function parse811PDF(file: File): Promise<ExtractedData> {
  try {
    const text = await extractTextFromPDF(file);

    // Normalize text for parsing
    const data: ExtractedData = {};

    // Extract ticket number (patterns like 811-2024-001, TICKET-12345, locate number, etc.)
    let ticketMatch = text.match(/(?:ticket\s*#?|ticket\s+number|locate\s+number|811[\s-]?\d+|request\s+#)[:\s]*([A-Z0-9\-]{5,20})/i);
    if (ticketMatch) {
      data.ticketNumber = ticketMatch[1].trim();
    } else {
      // Try iSite specific patterns
      ticketMatch = text.match(/([A-Z]{2}\d{6,10})/);
      if (ticketMatch) {
        data.ticketNumber = ticketMatch[1].trim();
      }
    }

    // Extract email addresses (look for multiple and pick first or most relevant)
    const emailMatches = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    if (emailMatches && emailMatches.length > 0) {
      // Prefer non-automated emails
      data.sourceEmail =
        emailMatches.find((e) => !e.includes('noreply') && !e.includes('notification')) ||
        emailMatches[0];
    }

    // Extract address (multiple patterns)
    let addressMatch = text.match(
      /(\d+\s+[A-Za-z\s\.]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway)[.,\s]+[A-Za-z\s]+[,\s]+(?:[A-Z]{2})?[,\s]*\d{0,5})/i
    );
    if (addressMatch) {
      data.parsedAddress = addressMatch[1].trim();
    } else {
      // Try iSite specific address pattern (sometimes formatted differently)
      addressMatch = text.match(/(?:address|location)[:\s]*([^\n]{20,80})/i);
      if (addressMatch) {
        data.parsedAddress = addressMatch[1].trim();
      }
    }

    // Extract coordinates - try multiple patterns
    let coordMatch = text.match(/latitude[:\s]*(-?\d+\.\d+).*longitude[:\s]*(-?\d+\.\d+)/i);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        data.coordinates = { lat, lng };
      }
    } else {
      // Try decimal degree format
      coordMatch = text.match(/(\d+\.\d+)\s*[,\s]+\s*(-?\d+\.\d+)/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          data.coordinates = { lat, lng };
        }
      }
    }

    // Extract date (multiple formats)
    let dateMatch = text.match(/(?:date|start|request)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i);
    if (dateMatch) {
      data.workStartDate = dateMatch[1];
    }

    // Extract utility companies with improved patterns
    const utilityPatterns: Record<string, string[]> = {
      'Electric': ['electric', 'power', 'electricity', 'edp', 'eel', 'utility electric'],
      'Gas': ['gas', 'natural gas', 'fuel gas', 'ngc', 'propane'],
      'Water': ['water', 'water/sewer', 'municipal water', 'water utility'],
      'Sewer': ['sewer', 'wastewater', 'sanitary sewer'],
      'Cable': ['cable', 'catv', 'cable tv'],
      'Telephone': ['telephone', 'phone', 'telecom'],
      'Fiber': ['fiber', 'fiber optic'],
      'Steam': ['steam', 'heating'],
    };

    const utilityLines: Map<string, { name: string; status: string }> = new Map();

    // Look for utility sections and extract them
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      Object.entries(utilityPatterns).forEach(([utilityName, patterns]) => {
        patterns.forEach((pattern) => {
          if (line.toLowerCase().includes(pattern)) {
            // Check status in this line or nearby lines
            let status = 'PENDING';
            const contextLines = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join(' ').toLowerCase();

            if (/responded|locate|located|marked|clear|ok|no|none/.test(contextLines)) {
              status = 'RESPONDED';
            }
            if (/clear|no conflict|cleared|ok/.test(contextLines)) {
              status = 'CLEAR';
            }
            if (/conflict|crossed|damage|hit/.test(contextLines)) {
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

    // Extract email subject from text context
    if (!data.emailSubject) {
      let subjectMatch = text.match(/(?:subject|re|fwd|fw)[:\s]*([^\n]{10,100})/i);
      if (subjectMatch) {
        data.emailSubject = subjectMatch[1].trim();
      } else {
        // Default to file name
        data.emailSubject = `811 Locate Request - ${file.name.replace('.pdf', '')}`;
      }
    }

    console.log('Extracted data from PDF:', data);
    return data;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return {
      emailSubject: `811 Locate Request - ${file.name.replace('.pdf', '')}`,
    };
  }
}
