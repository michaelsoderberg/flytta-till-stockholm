import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const request = (authorization?: string) =>
  new NextRequest("http://localhost/", { headers: authorization ? { authorization } : {} });
const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;

describe("basic auth middleware", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is open locally when no credentials are configured", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BASIC_AUTH_USER", "");
    expect(middleware(request()).status).toBe(200);
  });

  it("stays closed on Vercel when no credentials are configured", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BASIC_AUTH_USER", "");
    expect(middleware(request()).status).toBe(503);
  });

  it("asks for a password, and accepts only the right one", () => {
    vi.stubEnv("BASIC_AUTH_USER", "anna");
    vi.stubEnv("BASIC_AUTH_PASSWORD", "hemligt");
    expect(middleware(request()).status).toBe(401);
    expect(middleware(request()).headers.get("www-authenticate")).toContain("Basic");
    expect(middleware(request(basic("anna", "fel"))).status).toBe(401);
    expect(middleware(request(basic("anna", "hemligt"))).status).toBe(200);
  });

  it("is open to everyone once SITE_PUBLIC=1", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SITE_PUBLIC", "1");
    expect(middleware(request()).status).toBe(200);
  });
});
