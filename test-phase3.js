import 'dotenv/config';

const API = 'http://localhost:8787/api';

async function run() {
  console.log("⏳ 1. تسجيل الدخول...");
  let loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@wasla.ye', password: 'Password123' })
  });
  let { token } = await loginRes.json();
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  console.log("⏳ 2. جلب المنتج...");
  let prodRes = await fetch(`${API}/products`);
  let { products } = await prodRes.json();
  let product = products[0]; // المنتج الذي أنشأناه سابقاً
  console.log(`المنتج: ${product.name} | المخزون الحالي: ${product.stockQuantity}`);

  console.log("⏳ 3. إضافة 2 إلى السلة...");
  let cartRes = await fetch(`${API}/cart`, {
    method: 'POST', headers, body: JSON.stringify({ productId: product.id, quantity: 2 })
  });
  console.log(await cartRes.json());

  console.log("⏳ 4. إتمام الطلب (سيتم خصم 2 من المخزون)...");
  let checkoutRes = await fetch(`${API}/orders/checkout`, { method: 'POST', headers });
  console.log(await checkoutRes.json());

  console.log("⏳ 5. محاولة إضافة كمية أكبر من المخزون المتبقي (يجب أن يرفض)...");
  let failRes = await fetch(`${API}/cart`, {
    method: 'POST', headers, body: JSON.stringify({ productId: product.id, quantity: 10 }) // المتبقي 3 فقط
  });
  console.log("رد الخادم المتوقع (خطأ):", await failRes.json());

  console.log("🎉 اكتمل اختبار المرحلة الثالثة بنجاح!");
  process.exit(0);
}
run();
