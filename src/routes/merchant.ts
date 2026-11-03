import { Hono } from "hono";
import { db } from "../db/index.js";
import { subOrders, stores } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

export const merchantRoutes = new Hono();
merchantRoutes.use("*", requireAuth);

merchantRoutes.get("/orders", async (c) => {
  const user = c.get("user") as any;
  if (user.role !== "merchant" && user.role !== "admin") throw new AppError(403, "FORBIDDEN", "صلاحيات غير كافية");
  const [store] = await db.select().from(stores).where(eq(stores.ownerId, user.sub)).limit(1);
  if (!store) throw new AppError(404, "NO_STORE", "لا يوجد متجر");
  const orders = await db.select().from(subOrders).where(eq(subOrders.storeId, store.id));
  return c.json({ store: store.name, orders });
});

merchantRoutes.patch("/orders/:id/status", async (c) => {
  const user = c.get("user") as any;
  const { status } = await c.req.json();
  const orderId = c.req.param("id");
  const [store] = await db.select().from(stores).where(eq(stores.ownerId, user.sub)).limit(1);
  if (!store) throw new AppError(404, "NO_STORE", "لا يوجد متجر");
  const [order] = await db.select().from(subOrders).where(and(eq(subOrders.id, orderId), eq(subOrders.storeId, store.id))).limit(1);
  if (!order) throw new AppError(403, "FORBIDDEN", "هذا الطلب لا يخص متجرك");
  const [updated] = await db.update(subOrders).set({ status }).where(eq(subOrders.id, orderId)).returning();
  return c.json({ message: "تم تحديث الحالة", order: updated });
});

merchantRoutes.get("/my-store", async (c) => {
  const user = c.get("user") as any;
  const [store] = await db.select().from(stores).where(eq(stores.ownerId, user.sub)).limit(1);
  if (!store) return c.json({ error: "لا يوجد متجر" }, 404);
  return c.json({ store });
});
