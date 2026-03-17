import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { authenticateToken } from './middleware/auth.js';

import ordersRoutes from './routes/orders.routes.js';
import contractRoutes from './routes/contracts.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import customersRoutes from './routes/customers.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import usersRoutes from './routes/users.routes.js';
import blacklistRoutes from './routes/blacklist.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';
import productsRoutes from './routes/products.routes.js';
import cashboxesRoutes from './routes/cashboxes.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import cashSalesRoutes from './routes/cash-sales.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import authRoutes from './routes/auth.routes.js';
import expensesRoutes from './routes/expenses.routes.js';

import { getRegions } from './controllers/customers.controller.js';

dotenv.config();

const app = express();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("DIQQAT: JWT_SECRET .env faylida topilmadi!");
  process.exit(1);
}

/* =========================
   MIDDLEWARE
========================= */

app.use(cors({
  origin: [
    'https://iphone-house-frontend.vercel.app',
    'https://iphone-house.store',
    'https://www.iphone-house.store',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

/* =========================
   HEALTH CHECK
========================= */

app.get('/', (req, res) => {
  res.send('Iphone House API is Running! 🚀');
});

/* =========================
   ROUTES
========================= */

app.use('/api', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/users', usersRoutes);
app.get('/api/regions', authenticateToken, getRegions);
app.use('/api/blacklist-requests', blacklistRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/cashboxes', cashboxesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/cash-sales', cashSalesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/expenses', expensesRoutes);

export default app;