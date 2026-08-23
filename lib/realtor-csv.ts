import { z } from "zod";

export interface RealtorCsvRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const realtorCsvRowSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Email is invalid"),
  phone: z.string().trim(),
});

const HEADER_ALIASES = {
  name: ["name", "full name", "fullname", "realtor name", "agent name"],
  firstName: ["first name", "firstname", "first_name", "first"],
  lastName: ["last name", "lastname", "last_name", "last"],
  email: ["email", "email address", "emailaddress", "e-mail"],
  phone: ["phone", "phone number", "phonenumber", "mobile", "cell"],
};

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      record.push(field.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  record.push(field.trim());
  if (record.some(Boolean)) records.push(record);
  return records;
}

function findHeader(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

export function parseRealtorCsv(csv: string): {
  rows: RealtorCsvRow[];
  errors: Array<{ rowNumber: number; error: string }>;
} {
  const records = parseCsvRecords(csv.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("CSV must include a header and at least one realtor");

  const headers = records[0].map((header) => header.toLowerCase().trim());
  const indexes = {
    name: findHeader(headers, HEADER_ALIASES.name),
    firstName: findHeader(headers, HEADER_ALIASES.firstName),
    lastName: findHeader(headers, HEADER_ALIASES.lastName),
    email: findHeader(headers, HEADER_ALIASES.email),
    phone: findHeader(headers, HEADER_ALIASES.phone),
  };

  if (indexes.email < 0 || (indexes.name < 0 && (indexes.firstName < 0 || indexes.lastName < 0))) {
    throw new Error("CSV headers must include name and email, or first name, last name, and email");
  }

  const rows: RealtorCsvRow[] = [];
  const errors: Array<{ rowNumber: number; error: string }> = [];

  records.slice(1).forEach((record, offset) => {
    const rowNumber = offset + 2;
    const fullName = indexes.name >= 0 ? (record[indexes.name] || "").trim() : "";
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const candidate = {
      firstName: indexes.firstName >= 0 ? record[indexes.firstName] || "" : nameParts[0] || "",
      lastName: indexes.lastName >= 0 ? record[indexes.lastName] || "" : nameParts.slice(1).join(" "),
      email: (record[indexes.email] || "").toLowerCase(),
      phone: indexes.phone >= 0 ? record[indexes.phone] || "" : "",
    };
    const parsed = realtorCsvRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        rowNumber,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      });
      return;
    }
    rows.push({ rowNumber, ...parsed.data });
  });

  return { rows, errors };
}