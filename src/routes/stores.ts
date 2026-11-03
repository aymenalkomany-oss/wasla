import { Hono } from "hono";
import { db } from "../db/index.js";
import { stores, products } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

export const storeRoutes = new Hono();

// إنشاء متجر (للتاجر فقط)
storeRoutes.post("/", requireAuth, async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "merchant" && user.role !== "admin") throw new AppError(403, "FORBIDDEN", "فقط التجار يمكنهم إنشاء متجر");
  const { name, slug } = await c.req.json();
  const [store] = await db.insert(stores).values({ name, slug, ownerId: user.sub }).returning();
  return c.json({ store }, 201);
});

// جلب جميع المتاجر
storeRoutes.get("/", async (c) => {
  const list = await db.select().from(stores).where(eq(stores.status, "active"));
  return c.json({ stores: list });
});

// جلب منتجات متجر معين
storeRoutes.get("/:id/products", async (c) => {
  const list = await db.select().from(products).where(eq(products.storeId, c.req.param("id")));
  return c.json({ products: list });
});
