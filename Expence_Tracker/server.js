const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const categoryLimitRoutes = require('./routes/categoryLimitRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { ensureAuthenticated } = require('./utils/authHelpers');

const app = express();

// Establish the MongoDB connection once on server start.
async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';

  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}

connectToDatabase().catch((error) => {
  console.error('Failed to connect to MongoDB', error);
  process.exit(1);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules', 'chart.js', 'dist')));

const sessionSecret = process.env.SESSION_SECRET || 'super-secret-session-key';

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker_sessions',
      collectionName: 'sessions',
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.errors = null;
  res.locals.successMessage = req.session.successMessage || null;
  delete req.session.successMessage;
  next();
});

app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  return res.redirect('/dashboard');
});

app.use('/', authRoutes);
app.use('/transactions', ensureAuthenticated, transactionRoutes);
app.use('/category-limits', ensureAuthenticated, categoryLimitRoutes);
app.use('/api/analytics', ensureAuthenticated, analyticsRoutes);
app.use('/reports', ensureAuthenticated, reportRoutes);
app.use('/profile', ensureAuthenticated, profileRoutes);

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  return res.redirect('/transactions');
});

// Generic 404 handler.
app.use((req, res) => {
  res.status(404).render('404', { message: 'Page not found' });
});

// Centralized error handler keeps stack traces out of responses in production.
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong' : err.message;
  res.status(status).render('error', { message });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
