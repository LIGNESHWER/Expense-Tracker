# Expense Tracker - Complete Code Overview

## 📋 Project Summary

**Expense Tracker** is a full-stack web application built with Node.js, Express, MongoDB, and EJS. It enables users to:
- Register and manage secure accounts with password hashing
- Track income and expense transactions
- Visualize financial data with interactive charts
- Set category-based spending limits
- Export reports as PDF/CSV
- Manage user profiles with multi-currency support

**Tech Stack:**
- Backend: Node.js, Express.js, Mongoose ODM
- Frontend: EJS templates, HTML5, CSS3, Chart.js, vanilla JavaScript
- Database: MongoDB
- Security: bcryptjs (password hashing), express-session (authentication), express-validator (input validation)

---

## 🏗️ Architecture Overview

```
Expence_Tracker/
├── server.js                    # Express app entry point & configuration
├── models/                      # MongoDB schemas
│   ├── User.js                 # User schema with authentication
│   ├── Transaction.js          # Income/expense transactions
│   └── CategoryLimit.js        # Category spending limits
├── routes/                      # Route handlers
│   ├── authRoutes.js           # Registration, login, logout
│   ├── transactionRoutes.js    # CRUD for transactions
│   ├── analyticsRoutes.js      # Analytics data endpoints
│   ├── reportRoutes.js         # Report generation
│   ├── categoryLimitRoutes.js  # Budget limit management
│   └── profileRoutes.js        # User profile management
├── utils/                       # Helper utilities
│   ├── authHelpers.js          # Authentication middleware
│   ├── analyticsService.js     # Analytics computation
│   ├── reportService.js        # Report generation logic
│   ├── validationHelpers.js    # Input validation & sanitization
│   └── currencyHelpers.js      # Currency formatting
├── views/                       # EJS templates
│   ├── register.ejs            # User registration page
│   ├── login.ejs               # User login page
│   ├── dashboard.ejs           # Main dashboard with transactions
│   ├── reports.ejs             # Reports & analytics page
│   ├── profile.ejs             # User profile management
│   └── error.ejs & 404.ejs     # Error pages
├── public/                      # Static assets
│   ├── css/                    # Stylesheets
│   └── js/                     # Client-side scripts
├── package.json                # Dependencies
└── .env.example                # Environment template
```

---

## 🔐 Authentication Flow

### Registration Process
1. User submits registration form with name, email, password
2. **Validation** (authRoutes.js):
   - Name: 2-100 characters, HTML sanitized
   - Email: Valid email format, normalized
   - Password: Min 8 chars, must contain letters & numbers
3. **Database Check**: Ensures email doesn't already exist
4. **Password Hashing**: bcryptjs with 10 salt rounds (User.js pre-save hook)
5. **Session Creation**: User data stored in session
6. **Redirect**: User sent to dashboard

### Login Process
1. User enters email and password
2. **Validation**: Email format check
3. **Database Lookup**: Find user by email
4. **Password Comparison**: bcryptjs compares provided password with hashed version
5. **Session Creation**: Successful login creates session
6. **Redirect**: User sent to dashboard

### Logout
- Session destroyed via express-session
- Session cookie cleared
- User redirected to login page

### Session Management
- **Storage**: MongoDB via connect-mongo
- **Duration**: 24 hours (see server.js line 59)
- **Middleware**: res.locals.currentUser set on every request (line 65-70)
- **Protection**: ensureAuthenticated middleware checks req.session.user

---

## 📊 Database Models

### User Model (models/User.js)
```javascript
{
  name: String,              // 2-100 chars, required
  email: String,             // Unique, lowercase, required
  password: String,          // Min 8 chars, hashed with bcrypt
  currency: String,          // Enum: USD, EUR, GBP, INR, JPY, AUD, CAD, CHF, CNY, SEK
  profilePhoto: String,      // Base64 encoded image (optional)
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}

Methods:
- comparePassword(candidatePassword) -> Promise<Boolean>
```

### Transaction Model (models/Transaction.js)
```javascript
{
  user: ObjectId,            // Reference to User, indexed
  amount: Number,            // Positive number, required
  date: Date,                // Transaction date, default: now
  type: String,              // Enum: 'income' | 'expense'
  category: String,          // Max 100 chars (e.g., 'Salary', 'Groceries')
  description: String,       // Max 300 chars (optional)
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}

Indexes:
- user (for fast filtering by user)
```

### CategoryLimit Model (models/CategoryLimit.js)
```javascript
{
  user: ObjectId,                    // Reference to User, indexed
  category: String,                  // Original category name, sanitized
  normalizedCategory: String,        // Lowercase for matching (unique per user)
  limit: Number,                     // Min: 0, must be > 0 (validated)
  createdAt: Date,                   // Auto-generated
  updatedAt: Date                    // Auto-generated
}

Indexes:
- { user: 1, normalizedCategory: 1 } (unique compound index)

Pre-validate Hook:
- Sanitizes category text
- Normalizes to lowercase for consistency
```

---

## 🛣️ Route Handlers

### Authentication Routes (routes/authRoutes.js)

#### GET /register
- Renders registration form if not authenticated
- Redirects to dashboard if already logged in

#### POST /register
- **Validation**: Name, email, password, password confirmation
- **Error Handling**: Shows errors and preserves form data
- **Success**: Creates user, sets session, redirects to dashboard

#### GET /login
- Renders login form if not authenticated

#### POST /login
- **Validation**: Email format, password required
- **Lookup**: Finds user by email
- **Authentication**: Compares password hash
- **Error Handling**: Shows generic "Invalid credentials" message (security best practice)
- **Success**: Sets session, redirects to dashboard

#### POST /logout
- Destroys session
- Clears session cookie
- Redirects to login

---

### Transaction Routes (routes/transactionRoutes.js)

#### GET /transactions
- **Auth**: Required (via ensureAuthenticated middleware)
- **Pagination**: Shows 10 transactions per page
- **Data Fetching** (parallel via Promise.all):
  - User's transactions (paginated, sorted by date descending)
  - Total transaction count
  - Analytics data (via buildAnalytics utility)
- **Flash Messages**: Retrieves form errors and data from session
- **Response**: Renders dashboard.ejs with all data

#### POST /transactions
- **Validation**: Amount (positive float), date (ISO 8601), type (income/expense), category (2+ chars), description (optional, max 300)
- **Creation**: New transaction created with user ID
- **Redirect**: Back to /transactions

#### PUT /transactions/:id
- **Auth**: Required
- **Ownership Check**: Verifies transaction belongs to logged-in user
- **Validation**: Same as POST
- **Update**: Modifies existing transaction
- **Redirect**: Back to /transactions

#### DELETE /transactions/:id
- **Auth**: Required
- **Ownership Check**: Verifies transaction belongs to user
- **Deletion**: Removes transaction
- **Redirect**: Back to /transactions

#### POST /transactions/delete-all
- **Auth**: Required
- **Password Verification**: User must provide password for security
- **Bulk Delete**: Removes all transactions for user
- **Response**: JSON with success status and count

---

### Analytics Routes (routes/analyticsRoutes.js)
- Provides JSON endpoints for dashboard charts
- Data computed by buildAnalytics utility

---

### Report Routes (routes/reportRoutes.js)
- Generates PDF/CSV exports with filtering (date range, categories)
- Uses PDFKit library for PDF generation

---

### Category Limit Routes (routes/categoryLimitRoutes.js)
- CRUD operations for category spending limits
- Validates limits are positive numbers
- Prevents duplicate categories per user

---

### Profile Routes (routes/profileRoutes.js)
- Update user name, email, currency preference
- Upload/manage profile photo
- Display user information

---

## 🧮 Analytics Service (utils/analyticsService.js)

### buildAnalytics(userId, { months = 6 })
Computes comprehensive financial analytics with 5 parallel database queries:

**1. Total Aggregation**
- Groups all transactions by type (income/expense)
- Returns total income and total expense

**2. Expense by Category**
- Groups expenses by category
- Sorted by total descending
- Generates pie chart data

**3. Income by Source**
- Groups income by category (source)
- Sorted by total descending
- Generates pie chart data

**4. Monthly Trend**
- Groups transactions by year/month/type
- Calculates monthly income, expense, and savings
- Last 6 months by default
- Generates line chart data

**5. Category Limits**
- Fetches all limits for user
- Calculates spent amount per category
- Computes usage percentage and overage
- Marks exceeded limits

### Returns Object Structure
```javascript
{
  totals: {
    income: Number,
    expense: Number,
    savings: Number,
    savingsRate: Number (percentage)
  },
  charts: {
    incomeVsExpense: { labels, data, hasValues },
    savingsTrend: { labels, income, expense, savings, hasValues },
    expenseByCategory: { labels, data, hasValues },
    incomeBySource: { labels, data, hasValues }
  },
  categoryLimits: [
    {
      id: String,
      category: String,
      limit: Number,
      spent: Number,
      remaining: Number,
      percentageUsed: Number,
      percentageExceeded: Number,
      exceeded: Boolean
    }
  ]
}
```

---

## ✅ Validation & Security

### Input Validation (utils/validationHelpers.js)

**sanitizeText(text)**
- Removes HTML tags/scripts
- Trims whitespace
- Prevents XSS attacks

**normalizeCategory(category)**
- Converts to lowercase
- Removes extra whitespace
- Ensures consistent matching

### Express-Validator Rules

**Transaction Validation**
- Amount: Positive float, required
- Date: ISO 8601 format, required
- Type: Enum check (income/expense)
- Category: 2+ characters, sanitized
- Description: Optional, max 300 chars

**User Registration**
- Name: 2+ characters, sanitized
- Email: Valid format, normalized
- Password: 8+ chars, must contain letters and numbers
- Confirm Password: Must match original

### Security Practices
1. **Password Hashing**: bcryptjs with 10 salt rounds (bcrypt.genSalt(10))
2. **Session Management**: MongoDB-backed sessions with 24-hour expiration
3. **Input Sanitization**: HTML stripping, text normalization
4. **SQL Injection Prevention**: Mongoose ODM handles parameterization
5. **CSRF Protection**: Express sessions with secure cookies
6. **Authentication Middleware**: ensureAuthenticated checks all protected routes
7. **Ownership Verification**: All CRUD operations verify user ownership
8. **Generic Error Messages**: "Invalid credentials" doesn't reveal user existence

---

## 📁 Frontend Structure

### Templates (views/)
- **register.ejs**: Registration form with error display
- **login.ejs**: Login form with error display
- **dashboard.ejs**: Main interface with:
  - Transaction form (add/edit)
  - Transaction history table (paginated)
  - Chart visualizations (Chart.js)
  - Category limits display
  - Analytics summaries
- **reports.ejs**: Report page with filters and export options
- **profile.ejs**: User profile management

### Styling (public/css/)
- **styles.css**: Main stylesheet with responsive design
- **profile.css**: Profile-specific styles

### Client Scripts (public/js/)
- **dashboard.js**: Transaction form handling, pagination, chart rendering
- **ui.js**: UI interactions, theme toggle, form validation
- **profile.js**: Profile form handling, photo upload

---

## 🔄 Request-Response Flow Examples

### Example 1: Adding a Transaction
1. User fills form on dashboard (amount, date, type, category, description)
2. Form submits POST to /transactions
3. Express-validator validates input
4. Transaction document created in MongoDB
5. Redirect to /transactions (GET)
6. buildAnalytics recomputes all charts
7. Updated dashboard rendered

### Example 2: Viewing Dashboard
1. User visits /transactions (or /dashboard redirects here)
2. ensureAuthenticated checks req.session.user
3. 5 async queries execute (transactions, count, analytics)
4. Dashboard.ejs rendered with data
5. Chart.js charts initialize on client-side
6. User sees transactions, totals, and visualizations

### Example 3: Checking Budget Overage
1. User sets limit: "Groceries: $200/month"
2. CategoryLimit document created
3. User adds expense: "Groceries: $220"
4. buildAnalytics calculates spent vs limit
5. limitSummary shows:
   - spent: 220
   - limit: 200
   - exceeded: true
   - percentageExceeded: 10%
6. Dashboard highlights overage in red

---

## 📦 Dependencies

### Production
- **express** (5.1.0): Web framework
- **mongoose** (8.19.2): MongoDB ODM
- **bcryptjs** (3.0.3): Password hashing
- **express-session** (1.18.2): Session management
- **connect-mongo** (5.1.0): MongoDB session store
- **express-validator** (7.3.0): Input validation
- **ejs** (3.1.10): Template engine
- **body-parser** (2.2.0): Request parsing
- **method-override** (3.0.0): HTTP method override (PUT/DELETE)
- **dotenv** (17.2.3): Environment variable management
- **chart.js** (4.5.1): Client-side charting
- **pdfkit** (0.15.0): PDF generation

### Development
- **nodemon** (3.1.10): Auto-restart on file changes

---

## 🚀 Running the Application

### Setup
```powershell
npm install
```

### Environment Configuration
Create `.env` file:
```
MONGODB_URI=mongodb://127.0.0.1:27017/expense_tracker
SESSION_SECRET=your-secret-key-here
PORT=3000
```

### Development
```powershell
npm run dev
```
- Runs on http://localhost:3000
- Auto-restarts on file changes (nodemon)

### Production
```powershell
npm start
```
- Runs on PORT from .env or 3000

---

## 🔍 Key Code Patterns

### Pattern 1: Pre-Save Hook (Password Hashing)
```javascript
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});
```

### Pattern 2: Parallel Queries (Performance)
```javascript
const [transactions, count, analytics] = await Promise.all([
  Transaction.find(baseQuery).sort({ date: -1 }).skip(skip).limit(limit).lean(),
  Transaction.countDocuments(baseQuery),
  buildAnalytics(userId, { months: monthsToShow }),
]);
```

### Pattern 3: Middleware Chain
```javascript
app.use('/', authRoutes);
app.use('/transactions', ensureAuthenticated, transactionRoutes);
app.use('/api/analytics', ensureAuthenticated, analyticsRoutes);
```

### Pattern 4: Session Persistence
```javascript
req.session.user = {
  id: user._id,
  name: user.name,
  email: user.email,
  currency: user.currency || 'USD',
  profilePhoto: user.profilePhoto || null,
};
```

### Pattern 5: Ownership Verification
```javascript
const transaction = await Transaction.findOne({
  _id: req.params.id,
  user: req.session.user.id
});
if (!transaction) {
  return res.status(404).render('error', { message: 'Transaction not found.' });
}
```

---

## 📈 Data Flow Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP Request
       ▼
┌──────────────────────┐
│  Express Middleware  │
│ - Session Check      │
│ - Body Parse         │
│ - Validation         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Route Handler       │
│ - Auth Check         │
│ - Business Logic     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│   Mongoose ODM       │
│ - Validation         │
│ - Hooks (pre/post)   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│   MongoDB            │
│ - CRUD Operations    │
│ - Aggregations       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Response Builder    │
│ - EJS Render         │
│ - Data Formatting    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│   Browser Receives   │
│   HTML/JSON/Redirect │
└──────────────────────┘
```

---

## 🐛 Common Issues & Solutions

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env
   - Verify network connectivity

2. **Session Lost After Refresh**
   - Verify connect-mongo configuration
   - Check MongoDB session database exists
   - Ensure SESSION_SECRET is set

3. **Password Hashing Hangs**
   - Genning salt takes time; use async/await properly
   - Don't block event loop

4. **XSS Vulnerabilities**
   - Always use sanitizeText() for user input
   - Never use triple-braces in EJS ({%- unescaped -%})

5. **N+1 Query Problem**
   - Use .lean() for read-only queries (faster)
   - Use Promise.all() for parallel queries
   - Use aggregation for complex operations

---

## 💡 Best Practices Used

✅ **Security**
- Password hashing with bcrypt
- Input sanitization & validation
- Session-based authentication
- Ownership verification

✅ **Performance**
- Database indexing
- Lean queries
- Parallel queries with Promise.all
- Pagination (10 items per page)

✅ **Code Organization**
- Separation of concerns (models, routes, utils)
- Reusable middleware (ensureAuthenticated)
- Centralized error handling
- Service layer (analyticsService, reportService)

✅ **User Experience**
- Flash messages for errors
- Form data persistence
- Pagination navigation
- Responsive design
- Interactive charts

---

## 🎯 Next Steps for Learning

1. **Try modifying a route** - Add a new property to transactions
2. **Extend validation** - Add more complex validation rules
3. **Create a new feature** - Add recurring transactions
4. **Write tests** - Add unit tests for models
5. **Optimize queries** - Add more database indexes
6. **Enhance UI** - Improve dashboard styling
7. **Add notifications** - Implement budget alerts

---

## 📚 File Size Reference

```
models/
  ├── User.js              ~50 lines
  ├── Transaction.js       ~40 lines
  └── CategoryLimit.js     ~55 lines

routes/
  ├── authRoutes.js        ~150 lines
  ├── transactionRoutes.js ~220 lines
  ├── analyticsRoutes.js   ~50 lines
  ├── reportRoutes.js      ~100 lines
  ├── categoryLimitRoutes.js ~100 lines
  └── profileRoutes.js     ~100 lines

utils/
  ├── authHelpers.js       ~12 lines
  ├── analyticsService.js  ~205 lines
  ├── reportService.js     ~100 lines
  ├── validationHelpers.js ~50 lines
  └── currencyHelpers.js   ~50 lines

server.js                  ~109 lines
```

**Total Application Code: ~1,500 lines (excluding node_modules, views, public assets)**

---

**Happy Learning! 🚀**
