import { secret } from "encore.dev/config";

const jwtSecret = secret("JWTSecret");

export function getJwtSecretKey(): Uint8Array {
  const value = jwtSecret() || "dev-jwt-secret-change-in-production";
  return new TextEncoder().encode(value);
}
