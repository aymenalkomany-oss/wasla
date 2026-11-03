import { Hono } from "hono";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";

export const categoryRoutes = new Hono();

categoryRoutes.get("/", async (c) => {
  const list = await db.select().from(categories);
  return c.json({ categories: list });
});
