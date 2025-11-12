const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const CategoryLimit = require('../models/CategoryLimit');
const { normalizeCategory } = require('./validationHelpers');

function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }

  return new mongoose.Types.ObjectId(String(id));
}

function formatMonthlyKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildMonthLabels(startDate, months) {
  const labels = [];

  for (let index = 0; index < months; index += 1) {
    const current = new Date(startDate.getFullYear(), startDate.getMonth() + index, 1);
    labels.push(current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  }

  return labels;
}

async function buildAnalytics(userId, { months = 6 } = {}) {
  const normalizedMonths = Number.isInteger(months) && months > 0 ? months : 6;
  const objectId = toObjectId(userId);
  const rangeStart = new Date();
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setMonth(rangeStart.getMonth() - (normalizedMonths - 1));

  const [totalsAgg, expenseAgg, incomeAgg, monthlyAgg, categoryLimits] = await Promise.all([
    Transaction.aggregate([
      { $match: { user: objectId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { user: objectId, type: 'expense' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: { user: objectId, type: 'income' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: { user: objectId, date: { $gte: rangeStart } } },
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
    CategoryLimit.find({ user: objectId }).sort({ category: 1 }).lean(),
  ]);

  let incomeTotal = 0;
  let expenseTotal = 0;

  totalsAgg.forEach((entry) => {
    if (entry._id === 'income') {
      incomeTotal = entry.total;
    }
    if (entry._id === 'expense') {
      expenseTotal = entry.total;
    }
  });

  const savings = incomeTotal - expenseTotal;
  const savingsRate = incomeTotal > 0 ? (savings / incomeTotal) * 100 : 0;

  const expenseLabels = expenseAgg.map((entry) => entry._id || 'Uncategorized');
  const expenseData = expenseAgg.map((entry) => entry.total);
  const expenseHasValues = expenseData.some((value) => value > 0);

  const incomeLabels = incomeAgg.map((entry) => entry._id || 'Uncategorized');
  const incomeData = incomeAgg.map((entry) => entry.total);
  const incomeHasValues = incomeData.some((value) => value > 0);

  const expenseTotalsByCategory = new Map();

  expenseAgg.forEach((entry) => {
    if (typeof entry._id !== 'string') {
      return;
    }

    const normalized = normalizeCategory(entry._id);
    if (normalized) {
      expenseTotalsByCategory.set(normalized, entry.total);
    }
  });

  const monthlyMap = new Map();

  monthlyAgg.forEach((entry) => {
    const key = formatMonthlyKey(entry._id.year, entry._id.month);

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { income: 0, expense: 0 });
    }

    monthlyMap.get(key)[entry._id.type] = entry.total;
  });

  const monthlyLabels = buildMonthLabels(rangeStart, normalizedMonths);
  const monthlyIncome = [];
  const monthlyExpense = [];
  const monthlySavings = [];

  for (let index = 0; index < normalizedMonths; index += 1) {
    const currentDate = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + index, 1);
    const key = formatMonthlyKey(currentDate.getFullYear(), currentDate.getMonth() + 1);
    const values = monthlyMap.get(key) || { income: 0, expense: 0 };

    monthlyIncome.push(values.income || 0);
    monthlyExpense.push(values.expense || 0);
    monthlySavings.push((values.income || 0) - (values.expense || 0));
  }

  const monthlyHasValues = monthlyIncome.some((value) => value > 0) || monthlyExpense.some((value) => value > 0);

  const limitSummaries = categoryLimits.map((limit) => {
    const spent = expenseTotalsByCategory.get(limit.normalizedCategory) || 0;
    const usageRatio = limit.limit > 0 ? spent / limit.limit : 0;
    const exceeded = spent > limit.limit;
    const exceededRatio = exceeded ? (spent - limit.limit) / limit.limit : 0;

    return {
      id: String(limit._id),
      category: limit.category,
      limit: limit.limit,
      spent,
      remaining: Math.max(limit.limit - spent, 0),
      percentageUsed: usageRatio * 100,
      percentageExceeded: exceeded ? exceededRatio * 100 : 0,
      exceeded,
    };
  });

  return {
    totals: {
      income: incomeTotal,
      expense: expenseTotal,
      savings,
      savingsRate,
    },
    charts: {
      incomeVsExpense: {
        labels: ['Income', 'Expense'],
        data: [incomeTotal, expenseTotal],
        hasValues: incomeTotal > 0 || expenseTotal > 0,
      },
      savingsTrend: {
        labels: monthlyLabels,
        income: monthlyIncome,
        expense: monthlyExpense,
        savings: monthlySavings,
        hasValues: monthlyHasValues,
      },
      expenseByCategory: {
        labels: expenseLabels,
        data: expenseData,
        hasValues: expenseHasValues,
      },
      incomeBySource: {
        labels: incomeLabels,
        data: incomeData,
        hasValues: incomeHasValues,
      },
    },
    categoryLimits: limitSummaries,
  };
}

module.exports = {
  buildAnalytics,
};
