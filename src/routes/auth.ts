import { Hono } from "hono";
import { db } from "../db/index.js";
import { users, sessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { sign } from "hono/jwt";
import { AppError } from "../middleware/error.js";

export const authRoutes = new Hono();

authRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  const existing = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (existing.length) throw new AppError(409, "DUPLICATE", "البريد مسجل مسبقاً");
  
  const [user] = await db.insert(users).values({
    email: body.email, phone: body.phone, passwordHash: await hashPassword(body.password), fullName: body.fullName
  }).returning();
  
  const token = await sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || "default_secret_32_chars_long!!", "HS256");
  return c.json({ user: { id: user.id, email: user.email }, token }, 201);
});

authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new AppError(401, "AUTH_FAILED", "بيانات الدخول غير صحيحة");
  const token = await sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || "default_secret_32_chars_long!!", "HS256");
  return c.json({ user: { id: user.id, fullName: user.fullName }, token });
});
