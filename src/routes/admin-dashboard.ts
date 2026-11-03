import { Hono } from "hono";
import { db } from "../db/index.js";
import { orders, subOrders } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

export const adminDashboardRoutes = new Hono();
adminDashboardRoutes.use("*", requireAuth);

adminDashboardRoutes.use("*", async (c, next) => {
  const user = c.get("user") as any;
  if (user.role !== "admin") throw new AppError(403, "FORBIDDEN", "هذه الصفحة للمدير فقط");
  await next();
});

adminDashboardRoutes.get("/orders", async (c) => {
  const allOrders = await db.select().from(orders);
  const allSubOrders = await db.select().from(subOrders);
  return c.json({ mainOrders: allOrders, subOrders: allSubOrders });
});
