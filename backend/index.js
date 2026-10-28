const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

// ================================================================
// 1. ROUTE IMPORTS (All Modules)
// ================================================================
const authRoutes = require('./routes/auth.routes');
const planRoutes = require('./routes/plan.routes');
const memberRoutes = require('./routes/member.routes');
const membershipRoutes = require('./routes/membership.routes');
const billingRoutes = require('./routes/billing.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const staffRoutes = require('./routes/staff.routes');
const leadRoutes = require('./routes/lead.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const ptRoutes = require('./routes/pt.routes');
const classRoutes = require('./routes/class.routes');
const lockerRoutes = require('./routes/locker.routes');
const fitnessRoutes = require('./routes/fitness.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const saasSubscriptionRoutes = require('./routes/saasSubscription.routes');
const expenseRoutes = require('./routes/expense.routes');
const membershipLifecycleRoutes = require('./routes/membershipLifecycle.routes');
const discountRefundRoutes = require('./routes/discountRefund.routes');
const payrollRoutes = require('./routes/payroll.routes');
const memberSubrecordsRoutes = require('./routes/memberSubrecords.routes');
const systemConfigRoutes = require('./routes/systemConfig.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const posMasterRoutes = require('./routes/posMaster.routes');
const branchRoutes = require('./routes/branch.routes');
const roleRoutes = require('./routes/role.routes');
const profileRoutes = require('./routes/profile.routes');

// ================================================================
// 2. MIDDLEWARE IMPORTS
// ================================================================
const authMiddleware = require('./middlewares/auth.middleware');
const tenantGuard = require('./middlewares/tenant.middleware');
const { requireFeature } = require('./middlewares/subscription.middleware');
const saasController = require('./controllers/saasSubscription.controller');
const pool = require('./config/db');

const app = express();

// ================================================================
// 3. ENTERPRISE SECURITY & CORS OPTIMIZATION (With Preflight Cache)
// ================================================================
const rawOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error(`Blocked by CORS policy: Origin ${origin} is not allowed.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id', 'x-tenant-id'],
    maxAge: 86400 // 🚀 Caches OPTIONS response for 24 hours. Stops sending 6+ duplicate preflight roundtrips.
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📡 ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  }
  next();
});

// ================================================================
// 4. PUBLIC & INDEPENDENT PLATFORM ROUTES
// ================================================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.get('/api/v1/saas/plans', saasController.getAllAvailablePlans);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Gym Management SaaS Backend is active and running 🚀',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - start;

    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      dbLatency: `${dbLatencyMs}ms`,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ================================================================
// 5. TENANT-PROTECTED ROUTES WITH FEATURE ENTITLEMENTS
// ================================================================
app.use('/api/v1', authMiddleware, tenantGuard);

// 1. Core Modules
app.use('/api/v1/saas', saasSubscriptionRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/members', memberRoutes);
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/memberships', membershipRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/lockers', lockerRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/discounts', discountRefundRoutes);
app.use('/api/v1/subrecords', memberSubrecordsRoutes);
app.use('/api/v1/system', systemConfigRoutes);
app.use('/api/v1/profile', profileRoutes);

// 2. Growth, Pro & Enterprise Gated Modules
app.use('/api/v1/fitness', requireFeature('fitness_diet_engine'), fitnessRoutes);
app.use('/api/v1/pt', requireFeature('pt_management'), ptRoutes);
app.use('/api/v1/inventory', requireFeature('pos'), inventoryRoutes);
app.use('/api/v1', requireFeature('pos'), posMasterRoutes);

// 3. Pro & Enterprise Exclusive Modules
app.use('/api/v1/classes', requireFeature('classes'), classRoutes);
app.use('/api/v1/attendance', requireFeature('biometric_attendance'), attendanceRoutes);
app.use('/api/v1/staff', requireFeature('payroll'), staffRoutes);
app.use('/api/v1/payroll', require('./routes/payroll.routes'));
app.use('/api/v1/equipment', requireFeature('equipment_maintenance'), equipmentRoutes);
app.use('/api/v1/memberships/lifecycle', requireFeature('whatsapp_automation'), membershipLifecycleRoutes);

// ================================================================
// 6. ERROR HANDLING & 404
// ================================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  console.error('💥 Unhandled Error Caught:', err);

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload received.' });
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ================================================================
// 7. INITIALIZE & SHUTDOWN
// ================================================================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Enterprise Gym SaaS Server listening on port ${PORT}`);
  console.log(`🌐 Local Access: http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

const handleShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('🔒 HTTP server closed.');
    try {
      await pool.end();
      console.log('🗄️ Database connection closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database teardown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = app;