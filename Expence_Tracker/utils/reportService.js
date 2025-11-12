const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const { sanitizeText } = require('./validationHelpers');

function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }

  return new mongoose.Types.ObjectId(String(id));
}

function parseDate(value, boundary) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (boundary === 'start') {
    parsed.setHours(0, 0, 0, 0);
  } else if (boundary === 'end') {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatIsoDate(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : '';
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

function buildMatchStage(userId, filters) {
  const objectId = toObjectId(userId);
  const match = { user: objectId };

  if (filters.startDate || filters.endDate) {
    match.date = {};
    if (filters.startDate) {
      match.date.$gte = filters.startDate;
    }
    if (filters.endDate) {
      match.date.$lte = filters.endDate;
    }
  }

  if (filters.category) {
    match.category = { $regex: new RegExp(`^${escapeRegExp(filters.category)}$`, 'i') };
  }

  return match;
}

function buildDisplayLabel(filters) {
  const { startDate, endDate } = filters;

  if (startDate && endDate) {
  return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  }

  if (startDate) {
    return `From ${formatDisplayDate(startDate)}`;
  }

  if (endDate) {
    return `Up to ${formatDisplayDate(endDate)}`;
  }

  return 'All time';
}

function normalizeMonthlyAggregation(aggregation) {
  const monthlyMap = new Map();

  aggregation.forEach((entry) => {
    const { year, month, type } = entry._id;
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { year, month, income: 0, expense: 0 });
    }

    monthlyMap.get(key)[type] = entry.total;
  });

  return Array.from(monthlyMap.values())
    .sort((a, b) => new Date(b.year, b.month - 1, 1) - new Date(a.year, a.month - 1, 1))
    .map((entry) => ({
      label: new Date(entry.year, entry.month - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      income: entry.income || 0,
      expense: entry.expense || 0,
      net: (entry.income || 0) - (entry.expense || 0),
    }));
}

function normalizeYearlyAggregation(aggregation) {
  const yearlyMap = new Map();

  aggregation.forEach((entry) => {
    const { year, type } = entry._id;

    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, { year, income: 0, expense: 0 });
    }

    yearlyMap.get(year)[type] = entry.total;
  });

  return Array.from(yearlyMap.values())
    .sort((a, b) => b.year - a.year)
    .map((entry) => ({
      label: String(entry.year),
      income: entry.income || 0,
      expense: entry.expense || 0,
      net: (entry.income || 0) - (entry.expense || 0),
    }));
}

async function buildReport(userId, options = {}) {
  const filters = {
    startDate: parseDate(options.startDate, 'start'),
    endDate: parseDate(options.endDate, 'end'),
  category: sanitizeText(options.category || ''),
  };

  const matchStage = buildMatchStage(userId, filters);

  const [transactions, monthlyAgg, yearlyAgg, categories] = await Promise.all([
    Transaction.find(matchStage).sort({ date: -1 }).lean(),
    Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1 } },
    ]),
    Transaction.distinct('category', { user: toObjectId(userId) }),
  ]);

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((transaction) => {
    if (transaction.type === 'income') {
      totalIncome += transaction.amount;
    }
    if (transaction.type === 'expense') {
      totalExpense += transaction.amount;
    }
  });

  const monthly = normalizeMonthlyAggregation(monthlyAgg);
  const yearly = normalizeYearlyAggregation(yearlyAgg);

  const formattedFilters = {
    startDate: filters.startDate ? formatIsoDate(filters.startDate) : '',
    endDate: filters.endDate ? formatIsoDate(filters.endDate) : '',
    category: filters.category,
    displayRange: buildDisplayLabel(filters),
  };

  const summary = {
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    transactionCount: transactions.length,
  };

  const availableCategories = categories
    .filter((category) => typeof category === 'string')
    .map((category) => sanitizeText(category))
    .filter((category) => category.length)
    .sort((a, b) => a.localeCompare(b));

  return {
    filters: formattedFilters,
    summary,
    monthly,
    yearly,
    transactions,
    categories: availableCategories,
  };
}

module.exports = {
  buildReport,
};
