const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { sanitizeText } = require('../utils/validationHelpers');

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.render('register', { errors: [], formData: {} });
});

router.post(
  '/register',
  [
    body('name')
      .customSanitizer(sanitizeText)
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters long.'),
    body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.')
      .matches(/[A-Za-z]/)
      .withMessage('Password must contain at least one letter.'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).render('register', {
        errors: errors.array(),
        formData: {
          name: req.body.name,
          email: req.body.email,
        },
      });
    }

    try {
      const existingUser = await User.findOne({ email: req.body.email });

      if (existingUser) {
        return res.status(400).render('register', {
          errors: [{ msg: 'Email is already registered.' }],
          formData: {
            name: req.body.name,
            email: req.body.email,
          },
        });
      }

      const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
      });

      await user.save();

      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency || 'USD',
        profilePhoto: user.profilePhoto || null,
      };

      return res.redirect('/dashboard');
    } catch (error) {
      return next(error);
    }
  }
);

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.render('login', { errors: [], formData: {} });
});

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).render('login', {
        errors: errors.array(),
        formData: { email: req.body.email },
      });
    }

    try {
      const user = await User.findOne({ email: req.body.email });

      if (!user) {
        return res.status(401).render('login', {
          errors: [{ msg: 'Invalid credentials.' }],
          formData: { email: req.body.email },
        });
      }

      const isMatch = await user.comparePassword(req.body.password);

      if (!isMatch) {
        return res.status(401).render('login', {
          errors: [{ msg: 'Invalid credentials.' }],
          formData: { email: req.body.email },
        });
      }

      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency || 'USD',
        profilePhoto: user.profilePhoto || null,
      };

      return res.redirect('/dashboard');
    } catch (error) {
      return next(error);
    }
  }
);

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie('connect.sid');
    return res.redirect('/login');
  });
});

module.exports = router;
