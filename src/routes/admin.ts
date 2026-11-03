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
