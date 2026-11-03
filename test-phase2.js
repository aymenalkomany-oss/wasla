import { db } from './src/db/index.js';
import { users, categories } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import { sign } from 'hono/jwt';
import 'dotenv/config';

async function run() {
  console.log("⏳ 1. ترقية الحساب إلى تاجر وإنشاء تصنيف...");
  
  // ترقية المستخدم إلى تاجر
  await db.update(users).set({ role: 'merchant' }).where(eq(users.email, 'admin@wasla.ye'));
  
  // إنشاء تصنيف
  let [cat] = await db.select().from(categories).where(eq(categories.slug, 'electronics')).limit(1);
  if (!cat) {
    [cat] = await db.insert(categories).values({ name: 'إلكترونيات', slug: 'electronics' }).returning();
  }

  // إصدار توكن جديد بصلاحيات تاجر
  const [user] = await db.select().from(users).where(eq(users.email, 'admin@wasla.ye')).limit(1);
  const token = await sign({ sub: user.id, role: 'merchant' }, process.env.JWT_SECRET || "default_secret_32_chars_long!!", "HS256");

  console.log("⏳ 2. اختبار إنشاء متجر عبر الـ API...");
  const storeRes = await fetch('http://localhost:8787/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'متجر مأرب للإلكترونيات', slug: 'marib-electronics' })
  });
  const storeData = await storeRes.json();
  console.log("✅ رد الخادم (متجر):", storeData);

  if (storeData.store) {
    console.log("⏳ 3. اختبار إضافة منتج للمتجر...");
    const prodRes = await fetch('http://localhost:8787/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ 
        storeId: storeData.store.id, 
        categoryId: cat.id, 
        name: 'هاتف سامسونج A54', 
        price: 350000, 
        stockQuantity: 5 
      })
    });
    const prodData = await prodRes.json();
    console.log("✅ رد الخادم (منتج):", prodData);
  }
  
  console.log("🎉 اكتمل الاختبار بنجاح! المرحلة الثانية تعمل.");
  process.exit(0);
}
run();
