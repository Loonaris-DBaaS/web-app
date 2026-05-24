const loginService = require('../services/login.service');

/**
 * POST /auth/login
 * Authenticate user with email and password
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Call login service
    const user = await loginService.login(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', user.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        country: user.country,
        photo_url: user.photo_url,
        accessToken: user.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/refresh-token
 * Refresh access token using refresh token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    const { accessToken } = await loginService.refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed',
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /auth/logout
 * Revoke refresh token
 */
exports.logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    await loginService.logout(refreshToken);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};