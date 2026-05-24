const { prisma } = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Authenticate user with email and password
 */
exports.login = async (email, password) => {
  // 1. Validate input
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // 2. Find user by email
  const user = await prisma.tenant.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // 3. Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // 4. Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // 5. Save refresh token in DB
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      tenant_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // 6. Return user and tokens
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    country: user.country,
    photo_url: user.photo_url,
    accessToken,
    refreshToken,
  };
};

/**
 * Refresh access token using refresh token
 */
exports.refreshAccessToken = async (refreshToken) => {
  // 1. Validate input
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }

  // 2. Verify refresh token
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key');

    // 3. Check if refresh token exists in DB and not revoked
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord || tokenRecord.revoked_at) {
      throw new Error('Refresh token is invalid or revoked');
    }

    // 4. Check if token has expired
    if (new Date() > tokenRecord.expires_at) {
      throw new Error('Refresh token has expired');
    }

    // 5. Generate new access token
    const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '15m',
    });

    return { accessToken };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

/**
 * Logout - revoke refresh token
 */
exports.logout = async (refreshToken) => {
  // 1. Find and update refresh token
  await prisma.refreshToken.update({
    where: { token: refreshToken },
    data: { revoked_at: new Date() },
  });

  return { message: 'Logged out successfully' };
};

/**
 * Generate JWT tokens
 */
function generateTokens(userId) {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key', {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
}

exports.generateTokens = generateTokens;
