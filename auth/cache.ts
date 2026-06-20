import { CacheCluster, IntKeyspace, expireInMinutes } from "encore.dev/storage/cache";

const cluster = new CacheCluster("auth-cache", {
  evictionPolicy: "allkeys-lru",
});

// Tracks failed login attempts per email within a sliding window.
// The key expires automatically, which resets the counter.
export const loginAttempts = new IntKeyspace<{ email: string }>(cluster, {
  keyPattern: "login-attempts/:email",
  defaultExpiry: expireInMinutes(15),
});

export const MAX_LOGIN_ATTEMPTS = 5;
