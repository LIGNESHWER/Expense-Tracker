const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const { buildAnalytics } = require('../utils/analyticsService');
const { sanitizeText } = require('../utils/validationHelpers');

const router = express.Router();

const transactionValidationRules = [
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number.')
    .toFloat(),
  body('date').isISO8601().withMessage('Date is required.').toDate(),
  body('type')
    .trim()
    .toLowerCase()
    .isIn(['income', 'expense'])
    .withMessage('Type must be income or expense.'),
  body('category')
    .customSanitizer(sanitizeText)
    .isLength({ min: 2 })
    .withMessage('Category must be at least 2 characters.'),
  body('description')
    .optional({ checkFalsy: true })
    .customSanitizer(sanitizeText)
    .isLength({ max: 300 })
    .withMessage('Description is too long.'),
];

router.get('/', async (req, res, next) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const baseQuery = { user: userId };
    const flashErrors = req.session.formErrors || [];
    const flashFormData = req.session.formData || {};
    delete req.session.formErrors;
    delete req.session.formData;

    const monthsToShow = 6;

    const [transactions, count, analytics] = await Promise.all([
      Transaction.find(baseQuery)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(baseQuery),
      buildAnalytics(userId, { months: monthsToShow }),
    ]);

    const totalPages = Math.max(Math.ceil(count / limit), 1);

    return res.render('dashboard', {
      user: req.session.user,
      transactions,
      pagination: {
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      errors: flashErrors,
      formData: flashFormData,
      analytics,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', transactionValidationRules, async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    persistFormState(req, errors.array());
    return res.redirect('/transactions');
  }

  try {
    await Transaction.create({
      user: req.session.user.id,
      amount: req.body.amount,
      date: req.body.date,
      type: req.body.type,
      category: req.body.category,
      description: req.body.description,
    });

    return res.redirect('/transactions');
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', transactionValidationRules, async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    persistFormState(req, errors.array(), req.params.id);
    return res.redirect('/transactions');
  }

  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.session.user.id,
    });

    if (!transaction) {
      return res.status(404).render('error', { message: 'Transaction not found.' });
    }

    transaction.amount = req.body.amount;
    transaction.date = req.body.date;
    transaction.type = req.body.type;
    transaction.category = req.body.category;
    transaction.description = req.body.description;

    await transaction.save();

    return res.redirect('/transactions');
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.session.user.id,
    });

    if (!deleted) {
      return res.status(404).render('error', { message: 'Transaction not found.' });
    }

    return res.redirect('/transactions');
  } catch (error) {
    return next(error);
  }
});

function persistFormState(req, errors, transactionId) {
  req.session.formErrors = errors;
  const formData = {
    amount: req.body.amount,
    date:
      req.body.date instanceof Date
        ? req.body.date.toISOString().slice(0, 10)
        : req.body.date || '',
    type: req.body.type || '',
    category: sanitizeText(req.body.category || ''),
    description: sanitizeText(req.body.description || ''),
  };

  if (transactionId) {
    formData.transactionId = transactionId;
  }

  req.session.formData = formData;
}

// DELETE all transactions with password confirmation
router.post('/delete-all', async (req, res, next) => {
  try {
    const { password } = req.body;
    const User = require('../models/User');
    const bcrypt = require('bcrypt');

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required to delete all transactions.' 
      });
    }

    // Verify password
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password. Deletion cancelled.' 
      });
    }

    // Delete all transactions for this user
    const userId = new mongoose.Types.ObjectId(req.session.user.id);
    const result = await Transaction.deleteMany({ user: userId });

    res.json({ 
      success: true, 
      message: `Successfully deleted ${result.deletedCount} transaction(s).`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
