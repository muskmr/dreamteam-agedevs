import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SignJWT } from "jose";
import { getJwtSecretKey } from "./secrets";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./passwords";
import { loginAttempts, MAX_LOGIN_ATTEMPTS } from "./cache";

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: "admin" | "user";
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
}

export const login = api(
  { expose: true, method: "POST", path: "/auth/login" },
  async (req: LoginRequest): Promise<LoginResponse> => {
    const attempts = await loginAttempts.get({ email: req.email }).catch(() => 0);
    if ((attempts ?? 0) >= MAX_LOGIN_ATTEMPTS) {
      throw APIError.resourceExhausted(
        "too many failed login attempts, try again later",
      );
    }

    const user = await db.queryRow<UserRow>`
      SELECT id, email, password_hash, role FROM users WHERE email = ${req.email}
    `;

    if (!user || !verifyPassword(req.password, user.password_hash)) {
      await loginAttempts.increment({ email: req.email }, 1).catch(() => {});
      throw APIError.unauthenticated("invalid email or password");
    }

    await loginAttempts.delete({ email: req.email }).catch(() => {});

    const token = await new SignJWT({ email: user.email, role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(getJwtSecretKey());

    return { token };
  },
);

interface RegisterRequest {
  email: string;
  password: string;
}

interface RegisterResponse {
  userID: string;
  email: string;
}

export const register = api(
  { expose: true, method: "POST", path: "/auth/register" },
  async (req: RegisterRequest): Promise<RegisterResponse> => {
    if (!req.email || req.password.length < 8) {
      throw APIError.invalidArgument(
        "email is required and password must be at least 8 characters",
      );
    }

    const existing = await db.queryRow<{ id: number }>`
      SELECT id FROM users WHERE email = ${req.email}
    `;
    if (existing) {
      throw APIError.alreadyExists("a user with that email already exists");
    }

    const passwordHash = hashPassword(req.password);
    const row = await db.queryRow<{ id: number }>`
      INSERT INTO users (email, password_hash, role)
      VALUES (${req.email}, ${passwordHash}, 'user')
      RETURNING id
    `;

    return { userID: String(row!.id), email: req.email };
  },
);

interface ProfileResponse {
  userID: string;
  email: string;
  role: string;
}

export const profile = api(
  { expose: true, method: "GET", path: "/auth/profile", auth: true },
  async (): Promise<ProfileResponse> => {
    const data = getAuthData()!;
    return { userID: data.userID, email: data.email, role: data.role };
  },
);
