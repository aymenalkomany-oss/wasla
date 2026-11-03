mkdir -p src/db src/lib src/middleware src/routes

cat << 'JSON' > tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
JSON

cat << 'TS' > drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
TS

cat << 'TS' > src/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, pgEnum, boolean, decimal, integer, jsonb } from "drizzle-orm/pg-core";
export const userRoleEnum = pgEnum("user_role", ["customer", "merchant", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const merchantApplicationStatusEnum = pgEnum("merchant_application_status", ["pending", "approved", "rejected"]);
export const storeStatusEnum = pgEnum("store_status", ["active", "suspended"]);
export const productStatusEnum = pgEnum("product_status", ["active", "draft", "out_of_stock"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("customer"),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  status: storeStatusEnum("status").notNull().default("active"),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  name: varchar("name", { length: 255 }).notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  status: productStatusEnum("status").notNull().default("active"),
});
TS

cat << 'TS' > src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import 'dotenv/config';

const client = postgres(process.env.DATABASE_URL!, { max: 10, prepare: false });
export const db = drizzle(client, { schema });
TS

cat << 'TS' > src/lib/password.ts
import bcrypt from 'bcryptjs';
export const hashPassword = async (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = async (plain: string, hashed: string) => bcrypt.compare(plain, hashed);
TS

cat << 'TS' > src/middleware/error.ts
import { Context } from "hono";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) return c.json({ error: { code: err.code, message: err.message } }, err.status as any);
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "خطأ داخلي" } }, 500);
}
TS

cat << 'TS' > src/middleware/auth.ts
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
TS

cat << 'TS' > src/routes/auth.ts
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
TS

cat << 'TS' > src/routes/admin.ts
import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

export const adminRoutes = new Hono();
adminRoutes.use("*", requireAuth);

adminRoutes.get("/users", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "admin") throw new AppError(403, "FORBIDDEN", "صلاحيات غير كافية");
  const list = await db.select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role }).from(users);
  return c.json({ users: list });
});
TS

cat << 'TS' > src/index.ts
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/error.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';

const app = new Hono();
app.use('*', cors());
app.onError(errorHandler);

app.get('/', (c) => c.json({ status: 'WASLA API is running', time: new Date() }));
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);

const port = 8787;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 WASLA API running on http://localhost:${info.port}`);
});
TS

echo "✅ جميع الملفات تم إنشاؤها بنجاح!"
