# Expense Tracker

A full-stack expense tracker MVP built with Node.js, Express, MongoDB, and EJS. Users can register, manage their transactions, and view a dashboard summarizing income, expenses, and balance.

## Features

- Secure user registration and login with hashed passwords
- Session-based authentication with MongoDB-backed storage
- CRUD operations for income and expense transactions
- Dashboard with totals, interactive charts (income vs expense, savings trend, categories, and income sources), plus paginated history
- Reporting workspace with date/category filters and downloadable PDF/CSV exports
- Responsive navigation with optional dark/light mode toggle
- Server-side and client-side validation for all user inputs

## Tech Stack

- **Backend:** Node.js, Express, Mongoose
- **Frontend:** EJS, HTML5, CSS3, vanilla JavaScript, Chart.js
- **Database:** MongoDB

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or cloud)

### Installation

```powershell
npm install
```

### Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```
MONGODB_URI=mongodb://127.0.0.1:27017/expense_tracker
SESSION_SECRET=super-secret-session-key
PORT=3000
```

Adjust `MONGODB_URI` to point to your MongoDB deployment and use a strong session secret in production.

### Running the Project

Development mode with hot reload:

```powershell
npm run dev
```

Production mode:

```powershell
npm start
```

The app runs on `http://localhost:3000` by default.

## Usage Flow

1. Register a new user account.
2. Log in with the same credentials.
3. Add income or expense transactions via the dashboard form.
4. Edit or delete existing transactions from the history table.
5. Review totals, balance, and visual charts that update with each change.

## Project Structure

```
├── server.js           # Express app entry point
├── models/             # Mongoose models (User, Transaction)
├── routes/             # Auth, transaction, analytics, and report routes
├── views/              # EJS templates (auth pages, dashboard, errors)
├── public/             # Static assets (CSS, JS)
├── utils/              # Helper utilities
├── .env.example        # Sample environment config
├── package.json
└── README.md
```

## Validation & Security

- Passwords are hashed with bcrypt before storage.
- All protected routes require an active session.
- Input validated and sanitized via `express-validator` (type, length, formatting, HTML stripping).
- Sessions persist in MongoDB using `connect-mongo`.

## Next Steps

- Add role-based access or multi-user budgeting features.
- Implement API endpoints for potential SPA/mobile clients.
- Surface deeper budgeting insights like per-category budgets or alerts.
- Add automated tests (unit + integration).

## License

Distributed under the ISC License.
