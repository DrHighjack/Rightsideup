/// <reference types="vite/client" />
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { prisma } from "@/lib/prisma";
import { assertDisposableDatabase } from "./database";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: () => context.headers, cookies: () => ({ getAll: () => [] }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), setUser: vi.fn() }));
vi.mock("@/lib/email", () => new Proxy({}, {
  has: () => true,
  get: (_target, key) => key === "then" ? undefined : vi.fn(() => ({ subject: "Test", html: "Test" })),
}));
vi.mock("@/lib/discord", () => new Proxy({}, {
  has: () => true,
  get: (_target, key) => key === "then" ? undefined : vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => new Proxy({}, {
  has: () => true,
  get: (_target, key) => key === "then" ? undefined : vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/fluidpay", () => new Proxy({}, {
  has: () => true,
  get: (_target, key) => key === "then" ? undefined : vi.fn().mockResolvedValue({ transactionId: "test", status: "approved" }),
}));

const routeTable = [
  ["admin/2fa/confirm", "POST"],
  ["admin/2fa/disable", "POST"],
  ["admin/2fa", "GET"],
  ["admin/2fa/setup", "POST"],
  ["admin/811/[id]/assign-order", "POST"],
  ["admin/811/[id]", "GET PUT"],
  ["admin/811/[id]/send-cleared", "POST"],
  ["admin/811/[id]/stage", "PUT"],
  ["admin/811/[id]/utilities", "PUT"],
  ["admin/811", "GET POST"],
  ["admin/811/upload-pdf", "POST"],
  ["admin/activity", "GET"],
  ["admin/analytics", "GET"],
  ["admin/assignments/[id]", "DELETE PUT"],
  ["admin/assignments", "GET POST"],
  ["admin/assignments/unassigned", "GET"],
  ["admin/brokerages/[id]/access", "DELETE GET POST"],
  ["admin/brokerages/[id]/agents/attach", "POST"],
  ["admin/brokerages/[id]/agents/import", "POST"],
  ["admin/brokerages/[id]/invoice-schedule", "PATCH"],
  ["admin/brokerages/[id]", "DELETE GET POST PUT"],
  ["admin/brokerages/[id]/send-invitation", "POST"],
  ["admin/brokerages", "GET POST"],
  ["admin/clients", "GET"],
  ["admin/coupons", "GET POST"],
  ["admin/field-techs/[id]/profile", "GET PATCH"],
  ["admin/field-techs/[id]", "PATCH"],
  ["admin/field-techs", "GET POST"],
  ["admin/inventory/[id]", "DELETE PUT"],
  ["admin/inventory", "GET POST"],
  ["admin/inventory/upload", "POST"],
  ["admin/invoices/[id]", "DELETE GET PUT"],
  ["admin/invoices/[id]/send", "POST"],
  ["admin/invoices", "GET POST"],
  ["admin/leads/[id]/convert", "POST"],
  ["admin/leads/[id]", "GET PUT"],
  ["admin/leads/[id]/send-welcome-sms", "POST"],
  ["admin/leads", "GET"],
  ["admin/listing-link-requests", "GET PATCH"],
  ["admin/login-tracking", "GET"],
  ["admin/orders/[id]/photos", "DELETE GET POST"],
  ["admin/orders/[id]", "DELETE GET PUT"],
  ["admin/orders/[id]/schedule-removal", "POST"],
  ["admin/orders/[id]/send-completion", "POST"],
  ["admin/orders/map", "GET"],
  ["admin/orders", "GET POST"],
  ["admin/payments/refund", "POST"],
  ["admin/pricing/areas/[id]", "DELETE PATCH"],
  ["admin/pricing/areas", "GET POST"],
  ["admin/pricing/overrides/[id]/[action]", "DELETE PUT"],
  ["admin/pricing/overrides", "GET POST"],
  ["admin/pricing", "GET POST"],
  ["admin/printer-partnership-requests", "GET PATCH"],
  ["admin/printers/[id]", "DELETE PUT"],
  ["admin/printers", "GET POST"],
  ["admin/realtors/[id]", "GET"],
  ["admin/realtors", "GET"],
  ["admin/reports/clients", "GET"],
  ["admin/reports/field-techs", "GET"],
  ["admin/reports/inventory", "GET"],
  ["admin/reports/orders", "GET"],
  ["admin/reports/revenue", "GET"],
  ["admin/self811-policy", "GET PUT"],
  ["admin/settings", "GET POST"],
  ["admin/settings/test-discord", "POST"],
  ["admin/settings/test-imap", "POST"],
  ["admin/sign-reports/[id]/resolve", "PUT"],
  ["admin/sign-reports", "GET"],
  ["admin/signs/[id]", "GET PUT"],
  ["admin/signs/bulk", "POST"],
  ["admin/signs/map", "GET"],
  ["admin/signs", "GET POST"],
  ["admin/smart-sign", "GET PATCH POST"],
  ["admin/sms-logs", "GET"],
  ["admin/tcs/[id]/profile", "GET PUT"],
  ["admin/tcs/[id]", "DELETE PUT"],
  ["admin/tcs/[id]/send-invitation", "POST"],
  ["admin/tcs/create", "POST"],
  ["admin/tcs/link/[id]", "DELETE"],
  ["admin/tcs/link", "POST"],
  ["admin/tcs", "GET"],
  ["admin/users/[id]/impersonate", "POST"],
  ["admin/users/[id]/orders", "GET"],
  ["admin/users/[id]", "DELETE GET PUT"],
  ["admin/users/[id]/send-credit", "POST"],
  ["admin/users/[id]/send-sms", "POST"],
  ["admin/users/[id]/send-welcome", "POST"],
  ["admin/users", "GET POST"],
  ["admin/users/search", "GET"],
  ["realtor/811/[id]", "GET"],
  ["realtor/811", "GET POST"],
  ["realtor/self811-policy", "GET"],
  ["field/jobs/[id]/complete", "PUT"],
  ["field/jobs/[id]/flag", "PUT"],
  ["field/jobs/[id]", "GET"],
  ["field/jobs/[id]/start", "PUT"],
  ["field/jobs", "GET"],
  ["field/nfc-pairing", "GET POST"],
  ["auth/onboarding-status", "GET"],
  ["auth/onboarding-complete", "PUT"],
  ["smart-sign/subscription", "PATCH"],
] as const;

type Role = "ADMIN" | "REALTOR" | "TC" | "FIELD_TECH";
type RouteHandler = (request: NextRequest, context: { params: Record<string, string> }) => Promise<Response>;
const methods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);
const discovered = import.meta.glob("../../app/api/**/route.ts");
const modules = new Map<string, Record<string, RouteHandler>>();
const sessions = new Map<Role, string>();
const roles: Role[] = ["ADMIN", "REALTOR", "TC", "FIELD_TECH"];

function hasExclusiveCallerRoleGuard(file: string) {
  const source = readFileSync(path.resolve("tests/integration", file), "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const actors = new Set<string>();
  const roleAliases = new Set<string>();
  let exclusive = false;
  function findAliases(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = node.initializer.getText(tree);
      if (/^await (?:auth|getRequestUser)\(/.test(value)) actors.add(node.name.text);
      if (value.includes(".role") && Array.from(actors).some((actor) => value.startsWith(actor))) roleAliases.add(node.name.text);
    }
    ts.forEachChild(node, findAliases);
  }
  findAliases(tree);
  function findGuard(node: ts.Node) {
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(tree);
      const isCaller = Array.from(actors).some((actor) => condition.includes(`${actor}.role`) || condition.includes(`${actor}.user.role`))
        || Array.from(roleAliases).some((alias) => new RegExp(`\\b${alias}\\b`).test(condition));
      const referencedRoles = condition.match(/['"](?:REALTOR|TC|ADMIN|FIELD_TECH|BROKERAGE|SALESMEN)['"]/g) || [];
      const rejectsOtherRoles = /\.role\s*!==\s*['"](?:REALTOR|FIELD_TECH)['"]/.test(condition)
        || Array.from(roleAliases).some((alias) => new RegExp(`\\b${alias}\\s*!==\\s*['"](?:REALTOR|FIELD_TECH)['"]`).test(condition));
      if (isCaller && referencedRoles.length === 1 && /['"](?:REALTOR|FIELD_TECH)['"]/.test(referencedRoles[0])
        && rejectsOtherRoles && /status:\s*(?:401|403|.*\?\s*403)/.test(node.thenStatement.getText(tree))) exclusive = true;
    }
    ts.forEachChild(node, findGuard);
  }
  findGuard(tree);
  return exclusive;
}

beforeAll(async () => {
  assertDisposableDatabase(process.env.DATABASE_URL!);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External HTTP is forbidden in integration tests"); }));
  vi.stubEnv("FLUIDPAY_SECRET_KEY", "integration-dummy-key");
  await prisma.user.createMany({ data: roles.map((role) => ({
    id: `role-matrix-${role}`, email: `${role.toLowerCase()}@roles.example.test`,
    firstName: "Role", lastName: role, role, passwordHash: "not-used", emailVerifiedAt: new Date(),
  })) });
  for (const role of roles) {
    sessions.set(role, await encode({
      secret: process.env.AUTH_SECRET!, salt: "authjs.session-token",
      token: { id: `role-matrix-${role}`, sub: `role-matrix-${role}`, role, email: `${role.toLowerCase()}@roles.example.test` },
    }));
  }
  for (const [file, load] of Object.entries(discovered)) {
    const route = file.replace("../../app/api/", "").replace("/route.ts", "");
    if (/^(admin|realtor|field)\//.test(route) || hasExclusiveCallerRoleGuard(file)) {
      modules.set(route, await load() as Record<string, RouteHandler>);
    }
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: "role-matrix-" } } });
  await prisma.$disconnect();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("protected route table completeness", () => {
  it("requires an explicit table entry for every protected route and exported HTTP method", () => {
    const actual = Array.from(modules, ([route, module]) =>
      Object.keys(module).filter((method) => methods.has(method)).map((method) => `${route} ${method}`)
    ).flat().sort();
    const declared = routeTable.flatMap(([route, exports]) => exports.split(" ").map((method) => `${route} ${method}`)).sort();
    expect(actual).toEqual(declared);
    expect(new Set(declared).size).toBe(declared.length);
  });
});

const cases = routeTable.flatMap(([route, exports]) => exports.split(" ").flatMap((method) =>
  [null, ...roles].map((role) => ({ route, method, role, actor: role || "NO_SESSION" }))
));

describe("protected route role matrix", () => {
  it.each(cases)("$method /api/$route as $actor", async ({ route, method, role }) => {
    const allowed: Role[] = route.startsWith("admin/") ? ["ADMIN"]
      : route.startsWith("field/") ? ["FIELD_TECH"]
      : route.startsWith("realtor/") ? ["REALTOR", "TC"] : ["REALTOR"];
    const headers = new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" });
    if (role) headers.set("cookie", `authjs.session-token=${sessions.get(role)}`);
    context.headers = headers;
    const params: Record<string, string> = {};
    const pathname = route.replace(/\[([^\]]+)\]/g, (_match, name: string) => {
      params[name] = name === "action" ? "update" : "c0000000000000000000000099";
      return params[name];
    });
    const body = method === "GET" || method === "HEAD" ? undefined : "{}";
    if (body) headers.set("content-type", "application/json");
    const request = new NextRequest(`http://localhost:3000/api/${pathname}`, { method, headers, body });
    const handler = modules.get(route)?.[method];
    expect(handler, `${route} must export ${method}`).toBeTypeOf("function");
    const response = await handler!(request, { params });
    if (!role) expect(response.status).toBe(401);
    else if (!allowed.includes(role)) expect(response.status).toBe(403);
    else expect([401, 403]).not.toContain(response.status);
  });
});