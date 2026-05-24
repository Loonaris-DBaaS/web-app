const { prisma } = require('../../config/prisma');

/**
 * GET /auth/profile/:id
 * Get user profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.params.id || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await prisma.tenant.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        country: true,
        photo_url: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /auth/profile/:id
 * Update user profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.id || req.user?.id;
    const { username, country, photo_url } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Check if user exists
    const user = await prisma.tenant.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update user
    const updatedUser = await prisma.tenant.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(country && { country }),
        ...(photo_url && { photo_url }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        country: true,
        photo_url: true,
        created_at: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /auth/account/:id
 * Delete user account
 */
exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.params.id || req.user?.id;
    const { password } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Check if user exists
    const user = await prisma.tenant.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify password for security
    if (password) {
      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password',
        });
      }
    }

    // Delete user and related records (cascade delete)
    await prisma.tenant.delete({
      where: { id: userId },
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
