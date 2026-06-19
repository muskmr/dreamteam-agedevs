import { APIError, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { jwtVerify } from "jose";
import { getJwtSecretKey } from "./secrets";

interface AuthParams {
  authorization: Header<"Authorization">;
}

interface AuthData {
  userID: string;
  email: string;
  role: "admin" | "user";
}

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const token = params.authorization.replace(/^Bearer /i, "");

  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());

    return {
      userID: payload.sub as string,
      email: payload.email as string,
      role: payload.role as "admin" | "user",
    };
  } catch {
    throw APIError.unauthenticated("invalid token");
  }
});

export const gateway = new Gateway({ authHandler: auth });
