import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { SignJWT } from "jose";
import { getJwtSecretKey } from "./secrets";

const users = [
  {
    id: "user-1",
    email: "demo@example.com",
    password: "password123",
    role: "user" as const,
  },
  {
    id: "admin-1",
    email: "admin@example.com",
    password: "admin123",
    role: "admin" as const,
  },
];

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
    const user = users.find(
      (u) => u.email === req.email && u.password === req.password,
    );
    if (!user) {
      throw APIError.unauthenticated("invalid email or password");
    }

    const token = await new SignJWT({ email: user.email, role: user.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(getJwtSecretKey());

    return { token };
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
