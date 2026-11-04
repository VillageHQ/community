import { afterEach, describe, expect, it, vi } from "vitest";

import { createConnectionConfig } from "./connection-config";

const URL_WITH_SSLMODE = "postgresql://app:secret@db.example:25060/app?sslmode=require";
const CERTIFICATE = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----";

describe("createConnectionConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("without TLS settings", () => {
    it("leaves the URL untouched", () => {
      const config = createConnectionConfig(URL_WITH_SSLMODE, {});

      expect(config.connectionString).toBe(URL_WITH_SSLMODE);
      expect(config.ssl).toBeUndefined();
    });
  });

  describe("with a CA certificate", () => {
    it("verifies against it and removes sslmode from the URL", () => {
      const config = createConnectionConfig(URL_WITH_SSLMODE, { DATABASE_CA_CERT: CERTIFICATE });

      expect(config.ssl).toEqual({ ca: CERTIFICATE, rejectUnauthorized: true });
      expect(config.connectionString).not.toContain("sslmode");
    });

    it("ignores ssl=false in the URL", () => {
      const config = createConnectionConfig("postgres://app@db.example/app?ssl=false", {
        DATABASE_CA_CERT: CERTIFICATE,
      });

      expect(config.ssl).toEqual({ ca: CERTIFICATE, rejectUnauthorized: true });
      expect(config.connectionString).not.toContain("ssl");
    });

    it("restores newlines escaped by the host", () => {
      const config = createConnectionConfig(URL_WITH_SSLMODE, {
        DATABASE_CA_CERT: CERTIFICATE.replaceAll("\n", "\\n"),
      });

      expect(config.ssl).toEqual({ ca: CERTIFICATE, rejectUnauthorized: true });
    });
  });

  describe("with an unresolved certificate binding", () => {
    it("ignores it", () => {
      const config = createConnectionConfig(URL_WITH_SSLMODE, {
        DATABASE_CA_CERT: "${db.CA_CERT}",
      });

      expect(config.ssl).toBeUndefined();
    });
  });

  describe("with unverified TLS explicitly allowed", () => {
    it("disables verification only for this connection and warns", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const config = createConnectionConfig(URL_WITH_SSLMODE, {
        DATABASE_TLS_ALLOW_UNVERIFIED: "true",
      });

      expect(config.ssl).toEqual({ rejectUnauthorized: false });
      expect(config.connectionString).not.toContain("sslmode");
      expect(warn).toHaveBeenCalledOnce();
    });

    it("still prefers a CA certificate", () => {
      const config = createConnectionConfig(URL_WITH_SSLMODE, {
        DATABASE_CA_CERT: CERTIFICATE,
        DATABASE_TLS_ALLOW_UNVERIFIED: "true",
      });

      expect(config.ssl).toEqual({ ca: CERTIFICATE, rejectUnauthorized: true });
    });
  });
});
