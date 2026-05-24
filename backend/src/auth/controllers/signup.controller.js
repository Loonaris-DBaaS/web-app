const signupService = require('../services/signup.service');

/**
 * POST /auth/signup
 * Register a new user
 */
exports.signup = async (req, res, next) => {
  try {
    const { username, email, password, country } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required',
      });
    }

    // Call signup service
    const user = await signupService.signup({
      username,
      email,
      password,
      country,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};