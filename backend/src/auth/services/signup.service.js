const { prisma } = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.signup = async (data) => {
  const { username, email, password, country } = data;

  // 1. Validate input
  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required');
  }

  // 2. Check if tenant already exists
  const existingUser = await prisma.tenant.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new Error('Email already in use');
    }
    if (existingUser.username === username) {
      throw new Error('Username already in use');
    }
  }

  // 3. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 4. Create user in DB
  const user = await prisma.tenant.create({
    data: {
      username,
      email,
      password_hash: hashedPassword,
      country: country || null,
    },
  });

  // 5. Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id);

  // 6. Save refresh token in DB
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      tenant_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // 7. Return safe user (no password)
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

