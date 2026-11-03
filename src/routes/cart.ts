import { Hono } from "hono";
import { db } from "../db/index.js";
import { cartItems, products } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

export const cartRoutes = new Hono();
cartRoutes.use("*", requireAuth);

// إضافة منتج للسلة
cartRoutes.post("/", async (c) => {
  const user = c.get("user") as any;
  const { productId, quantity } = await c.req.json();
  
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw new AppError(404, "NOT_FOUND", "المنتج غير موجود");
  if (product.stockQuantity < quantity) throw new AppError(400, "OUT_OF_STOCK", "الكمية المطلوبة غير متوفرة في المخزون");

  // إذا كان المنتج موجود مسبقاً، نزيد الكمية، وإلا نضيفه
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.userId, user.sub), eq(cartItems.productId, productId))).limit(1);
  if (existing) {
    await db.update(cartItems).set({ quantity: existing.quantity + quantity }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ userId: user.sub, productId, quantity });
  }
  return c.json({ message: "تمت الإضافة للسلة" }, 201);
});

// عرض السلة
cartRoutes.get("/", async (c) => {
  const user = c.get("user") as any;
  const items = await db.select({
    id: cartItems.id, quantity: cartItems.quantity, product: products
  }).from(cartItems).innerJoin(products, eq(cartItems.productId, products.id)).where(eq(cartItems.userId, user.sub));
  return c.json({ cart: items });
});
