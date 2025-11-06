const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const CategoryLimit = require('../models/CategoryLimit');
const { sanitizeText, normalizeCategory } = require('../utils/validationHelpers');

const router = express.Router();

const limitValidationRules = [
    body('category')
        .customSanitizer(sanitizeText)
        .isLength({ min: 2 })
        .withMessage('Category must be at least 2 characters.'),
    body('limit')
        .isFloat({ gt: 0 })
        .withMessage('Limit must be greater than zero.')
        .toFloat(),
    body('limitId')
        .optional({ checkFalsy: true })
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage('Invalid category limit identifier.'),
];

router.post('/', limitValidationRules, async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        persistLimitState(req, errors.array(), req.body.limitId);
        return res.redirect('/transactions');
    }

    try {
        const category = req.body.category;
        const limitValue = req.body.limit;
        const normalizedCategory = normalizeCategory(category);
        const userId = req.session.user.id;

        if (req.body.limitId) {
            const existing = await CategoryLimit.findOne({ _id: req.body.limitId, user: userId });

            if (!existing) {
                persistLimitState(req, [{ msg: 'Category limit not found.' }], req.body.limitId);
                return res.redirect('/transactions');
            }

            existing.category = category;
            existing.normalizedCategory = normalizedCategory;
            existing.limit = limitValue;

            await existing.save();
        } else {
            await CategoryLimit.findOneAndUpdate(
                { user: userId, normalizedCategory },
                { category, normalizedCategory, limit: limitValue },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        return res.redirect('/transactions');
    } catch (error) {
        if (error.code === 11000) {
            persistLimitState(req, [{ msg: 'A limit for this category already exists.' }], req.body.limitId);
            return res.redirect('/transactions');
        }

        return next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            persistLimitState(req, [{ msg: 'Invalid category limit identifier.' }]);
            return res.redirect('/transactions');
        }

        const deleted = await CategoryLimit.findOneAndDelete({ _id: id, user: req.session.user.id });

        if (!deleted) {
            persistLimitState(req, [{ msg: 'Category limit not found.' }]);
        }

        return res.redirect('/transactions');
    } catch (error) {
        return next(error);
    }
});

function persistLimitState(req, errors, limitId) {
    req.session.limitErrors = errors;
    const payload = req.body || {};
    req.session.limitFormData = {
        category: sanitizeText(payload.category || ''),
        limit: payload.limit,
    };

    if (limitId) {
        req.session.limitFormData.limitId = limitId;
    }
}

module.exports = router;
