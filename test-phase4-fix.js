import 'dotenv/config';
import { db } from './src/db/index.js';
import { users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const API = 'http://localhost:8787/api';

async function run() {
  console.log("⏳ 1. تسجيل الدخول كتاجر...");
  let loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@wasla.ye', password: 'Password123' })
  });
  let { token } = await loginRes.json();
  let headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  console.log("⏳ 2. جلب طلبات التاجر...");
  let ordersRes = await fetch(`${API}/merchant/orders`, { headers });
  let ordersData = await ordersRes.json();
  
  if (ordersData.orders && ordersData.orders.length > 0) {
    const orderId = ordersData.orders[0].id;
    console.log(`⏳ 3. تحديث حالة الطلب إلى "preparing"...`);
    await fetch(`${API}/merchant/orders/${orderId}/status`, {
      method: 'PATCH', headers, body: JSON.stringify({ status: 'preparing' })
    });
    console.log("✅ تم التحديث");
  }

  console.log("⏳ 4. ترقية الحساب إلى مدير وإعادة تسجيل الدخول...");
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, 'admin@wasla.ye'));
  
  loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@wasla.ye', password: 'Password123' })
  });
  let newToken = (await loginRes.json()).token;
  let adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newToken}` };

  console.log("⏳ 5. اختبار لوحة المدير (رؤية كل الطلبات)...");
  let adminRes = await fetch(`${API}/admin-dashboard/orders`, { headers: adminHeaders });
  let adminData = await adminRes.json();
  console.log(`عدد الطلبات الرئيسية في المنصة: ${adminData.mainOrders.length}`);
  console.log(`عدد الطلبات الفرعية في المنصة: ${adminData.subOrders.length}`);

  console.log("🎉 اكتمل اختبار المرحلة الرابعة بنجاح!");
  process.exit(0);
}
run();
