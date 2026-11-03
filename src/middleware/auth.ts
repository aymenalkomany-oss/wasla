import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { AppError } from "./error.js";

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw new AppError(401, "UNAUTHORIZED", "مطلوب تسجيل الدخول");
  try {
    const payload = await verify(header.slice(7), process.env.JWT_SECRET || "default_secret_32_chars_long!!", "HS256");
    c.set("user", payload);
    await next();
  } catch { throw new AppError(401, "INVALID_TOKEN", "جلسة غير صالحة"); }
});
