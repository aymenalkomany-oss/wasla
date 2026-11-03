import { Hono } from "hono";
import { db } from "../db/index.js";
import { products, stores } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

export const productRoutes = new Hono();

// إضافة منتج
productRoutes.post("/", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const { storeId, categoryId, name, price, stockQuantity } = await c.req.json();
  
  // التأكد أن المتجر يخص التاجر
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store || (store.ownerId !== user.sub && user.role !== "admin")) throw new AppError(403, "FORBIDDEN", "لا تملك هذا المتجر");

  const [product] = await db.insert(products).values({
    storeId, categoryId, name, price: price.toString(), stockQuantity
  }).returning();
  return c.json({ product }, 201);
});

// جلب جميع المنتجات
productRoutes.get("/", async (c) => {
  const list = await db.select().from(products).where(eq(products.status, "active"));
  return c.json({ products: list });
});
