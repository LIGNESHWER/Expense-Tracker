const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

// GET profile page
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      return res.status(404).render('error', { message: 'User not found' });
    }

    const errors = req.session.profileErrors || null;
    const formData = req.session.profileFormData || {};
    
    delete req.session.profileErrors;
    delete req.session.profileFormData;

    return res.render('profile', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency || 'USD',
        profilePhoto: user.profilePhoto || null,
      },
      errors,
      formData,
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    return res.status(500).render('error', { message: 'Failed to load profile' });
  }
});

// POST update profile
router.post(
  '/update',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('currency')
      .isIn(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK'])
      .withMessage('Please select a valid currency'),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.session.profileErrors = errors.array();
      req.session.profileFormData = req.body;
      return res.redirect('/profile');
    }

    try {
      const { name, email, currency, profilePhoto } = req.body;
      const userId = req.session.user.id;

      // Check if email is already taken by another user
      if (email !== req.session.user.email) {
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
          req.session.profileErrors = [{ msg: 'Email is already in use by another account' }];
          req.session.profileFormData = req.body;
          return res.redirect('/profile');
        }
      }

      const updateData = {
        name,
        email,
        currency,
      };

      // Only update profile photo if provided
      if (profilePhoto && profilePhoto.trim() !== '') {
        updateData.profilePhoto = profilePhoto;
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        req.session.profileErrors = [{ msg: 'User not found' }];
        return res.redirect('/profile');
      }

      // Update session data
      req.session.user = {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        currency: updatedUser.currency,
        profilePhoto: updatedUser.profilePhoto,
      };

      req.session.successMessage = 'Profile updated successfully!';
      return res.redirect('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      req.session.profileErrors = [{ msg: 'Failed to update profile. Please try again.' }];
      req.session.profileFormData = req.body;
      return res.redirect('/profile');
    }
  }
);

// POST remove profile photo
router.post('/remove-photo', async (req, res) => {
  try {
    const userId = req.session.user.id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: null },
      { new: true }
    );

    if (!updatedUser) {
      req.session.profileErrors = [{ msg: 'User not found' }];
      return res.redirect('/profile');
    }

    // Update session
    req.session.user.profilePhoto = null;
    req.session.successMessage = 'Profile photo removed successfully!';
    return res.redirect('/profile');
  } catch (error) {
    console.error('Error removing profile photo:', error);
    req.session.profileErrors = [{ msg: 'Failed to remove profile photo' }];
    return res.redirect('/profile');
  }
});

module.exports = router;
