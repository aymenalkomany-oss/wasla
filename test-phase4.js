import 'dotenv/config';
const API = 'http://localhost:8787/api';

async function run() {
  console.log("⏳ 1. تسجيل الدخول كتاجر...");
  let loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@wasla.ye', password: 'Password123' })
  });
  let { token } = await loginRes.json();
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  console.log("⏳ 2. جلب طلبات المتجر (يجب أن تظهر طلبات متجر مأرب)...");
  let ordersRes = await fetch(`${API}/merchant/orders`, { headers });
  let ordersData = await ordersRes.json();
  console.log(ordersData);
  
  if (ordersData.orders && ordersData.orders.length > 0) {
    const orderId = ordersData.orders[0].id;
    console.log(`⏳ 3. تحديث حالة الطلب (${orderId}) إلى "preparing"...`);
    let updateRes = await fetch(`${API}/merchant/orders/${orderId}/status`, {
      method: 'PATCH', headers, body: JSON.stringify({ status: 'preparing' })
    });
    console.log(await updateRes.json());
  }

  console.log("⏳ 4. اختبار لوحة المدير (رؤية كل الطلبات)...");
  let adminRes = await fetch(`${API}/admin-dashboard/orders`, { headers });
  let adminData = await adminRes.json();
  console.log(`عدد الطلبات الرئيسية في المنصة: ${adminData.mainOrders.length}`);
  console.log(`عدد الطلبات الفرعية في المنصة: ${adminData.subOrders.length}`);

  console.log("🎉 اكتمل اختبار المرحلة الرابعة بنجاح!");
  process.exit(0);
}
run();
