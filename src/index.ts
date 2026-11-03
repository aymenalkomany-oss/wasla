import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { errorHandler } from './middleware/error.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { storeRoutes } from './routes/stores.js';
import { productRoutes } from './routes/products.js';
import { cartRoutes } from './routes/cart.js';
import { orderRoutes } from './routes/orders.js';
import { merchantRoutes } from './routes/merchant.js';
import { adminDashboardRoutes } from './routes/admin-dashboard.js';
import { categoryRoutes } from './routes/categories.js';

const app = new Hono();
app.use('*', cors());
app.onError(errorHandler);

app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/stores', storeRoutes);
app.route('/api/products', productRoutes);
app.route('/api/cart', cartRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/merchant', merchantRoutes);
app.route('/api/admin-dashboard', adminDashboardRoutes);
app.route('/api/categories', categoryRoutes);

app.use('/*', serveStatic({ root: './public' }));
app.get('/', serveStatic({ path: './public/index.html' }));

const port = 8787;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 WASLA API running on http://localhost:${info.port}`);
});
