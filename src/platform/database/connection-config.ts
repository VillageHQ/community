import type { ClientConfig } from "pg";

import type { Environment } from "../environment.ts";

const CONNECTION_TIMEOUT_MS = 5_000;
const PEM_CERTIFICATE_HEADER = "-----BEGIN CERTIFICATE-----";
const URL_TLS_PARAMETERS = [
  "ssl",
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslpassword",
  "uselibpqcompat",
];

function readCaCertificate(environment: Environment) {
  const certificate = environment.DATABASE_CA_CERT?.replaceAll("\\n", "\n");
  return certificate?.includes(PEM_CERTIFICATE_HEADER) ? certificate : null;
}

// pg lets TLS settings in the URL override the `ssl` option, so they must go when we set `ssl`.
function removeTlsParameters(connectionString: string) {
  const url = new URL(connectionString);
  URL_TLS_PARAMETERS.forEach((parameter) => url.searchParams.delete(parameter));
  return url.toString();
}

export function createConnectionConfig(
  connectionString: string,
  environment: Environment,
): ClientConfig {
  const baseConfig = { connectionTimeoutMillis: CONNECTION_TIMEOUT_MS };
  const caCertificate = readCaCertificate(environment);

  if (caCertificate) {
    return {
      ...baseConfig,
      connectionString: removeTlsParameters(connectionString),
      ssl: { ca: caCertificate, rejectUnauthorized: true },
    };
  }

  if (environment.DATABASE_TLS_ALLOW_UNVERIFIED === "true") {
    console.warn("Database TLS certificate verification is off: no CA certificate available.");
    return {
      ...baseConfig,
      connectionString: removeTlsParameters(connectionString),
      ssl: { rejectUnauthorized: false },
    };
  }

  return { ...baseConfig, connectionString };
}
