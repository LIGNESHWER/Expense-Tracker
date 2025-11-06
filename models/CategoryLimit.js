const mongoose = require('mongoose');
const { sanitizeText, normalizeCategory } = require('../utils/validationHelpers');

const categoryLimitSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        normalizedCategory: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            lowercase: true,
        },
        limit: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator(value) {
                    return Number.isFinite(value) && value > 0;
                },
                message: 'Limit must be greater than zero.',
            },
        },
    },
    { timestamps: true }
);

categoryLimitSchema.index({ user: 1, normalizedCategory: 1 }, { unique: true });

categoryLimitSchema.pre('validate', function setNormalizedCategory(next) {
    const sanitizedCategory = sanitizeText(this.category || '');
    this.category = sanitizedCategory;
    this.normalizedCategory = normalizeCategory(sanitizedCategory);

    if (!this.category) {
        this.invalidate('category', 'Category is required.');
    }

    next();
});

module.exports = mongoose.model('CategoryLimit', categoryLimitSchema);
