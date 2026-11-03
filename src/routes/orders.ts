import { Hono } from "hono";
import { db } from "../db/index.js";
import { cartItems, orders, subOrders, orderItems, products } from "../db/schema.js";
import { eq, sql, and, gte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";

export const orderRoutes = new Hono();
orderRoutes.use("*", requireAuth);

// إتمام الطلب
orderRoutes.post("/checkout", async (c) => {
  const user = c.get("user") as any;
  
  return await db.transaction(async (tx) => {
    // 1. جلب السلة
    const cart = await tx.select({
      productId: cartItems.productId, quantity: cartItems.quantity, 
      price: products.price, storeId: products.storeId, stock: products.stockQuantity
    }).from(cartItems).innerJoin(products, eq(cartItems.productId, products.id)).where(eq(cartItems.userId, user.sub));

    if (cart.length === 0) throw new AppError(400, "EMPTY_CART", "السلة فارغة");

    // 2. التحقق من المخزون
    for (const item of cart) {
      if (item.stock < item.quantity) throw new AppError(400, "OUT_OF_STOCK", `نفد المخزون من أحد المنتجات`);
    }

    // 3. خصم المخزون (بأمان تام)
    for (const item of cart) {
      const result = await tx.update(products)
        .set({ stockQuantity: sql`${products.stockQuantity} - ${item.quantity}` })
        .where(and(eq(products.id, item.productId), gte(products.stockQuantity, item.quantity)))
        .returning();
      if (result.length === 0) throw new AppError(400, "CONCURRENCY_ERROR", "حدث خطأ أثناء حجز المخزون");
    }

    // 4. إنشاء الطلب الرئيسي
    const totalAmount = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    const [mainOrder] = await tx.insert(orders).values({ userId: user.sub, totalAmount: totalAmount.toString() }).returning();

    // 5. تقسيم الطلب حسب المتاجر
    const storeGroups: Record<string, typeof cart> = {};
    for (const item of cart) {
      if (!storeGroups[item.storeId]) storeGroups[item.storeId] = [];
      storeGroups[item.storeId].push(item);
    }

    for (const [storeId, items] of Object.entries(storeGroups)) {
      const subTotal = items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
      const [subOrder] = await tx.insert(subOrders).values({ orderId: mainOrder.id, storeId, totalAmount: subTotal.toString() }).returning();

      for (const item of items) {
        await tx.insert(orderItems).values({
          subOrderId: subOrder.id, productId: item.productId, quantity: item.quantity, priceAtPurchase: item.price
        });
      }
    }

    // 6. تفريغ السلة
    await tx.delete(cartItems).where(eq(cartItems.userId, user.sub));
    return c.json({ message: "تم الطلب وتقسيمه بنجاح", orderId: mainOrder.id });
  });
});
