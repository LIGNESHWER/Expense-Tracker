const express = require('express');
const { buildAnalytics } = require('../utils/analyticsService');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const months = req.query.months ? Number.parseInt(req.query.months, 10) : undefined;
    const analytics = await buildAnalytics(req.session.user.id, {
      months: Number.isNaN(months) ? undefined : months,
    });

    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
