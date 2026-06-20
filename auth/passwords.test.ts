import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./passwords";

describe("password hashing", () => {
  test("verifies a correct password", () => {
    const stored = hashPassword("supersecret");
    expect(verifyPassword("supersecret", stored)).toBe(true);
  });

  test("rejects an incorrect password", () => {
    const stored = hashPassword("supersecret");
    expect(verifyPassword("wrongpassword", stored)).toBe(false);
  });

  test("produces a unique salt per hash", () => {
    expect(hashPassword("samepw")).not.toBe(hashPassword("samepw"));
  });

  test("rejects malformed stored values", () => {
    expect(verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});
