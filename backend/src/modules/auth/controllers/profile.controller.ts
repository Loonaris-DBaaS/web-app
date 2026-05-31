import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const PROFILE_SELECT = {
  id: true, username: true, email: true,
  country: true, jobTitle: true, company: true,
  isAdmin: true, photoUrl: true, createdAt: true,
} as const;

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as JwtPayload)['id'] as string;
    const tenant = await prisma.tenant.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!tenant) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Profile retrieved successfully', data: tenant });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as JwtPayload)['id'] as string;
    const { username, country, jobTitle, company, photoUrl } = req.body as {
      username?: string;
      country?: string;
      jobTitle?: string;
      company?: string;
      photoUrl?: string;
    };
    const updated = await prisma.tenant.update({
      where: { id: userId },
      data: {
        ...(username                 && { username }),
        ...(country   !== undefined  && { country:  country  || null }),
        ...(jobTitle  !== undefined  && { jobTitle: jobTitle || null }),
        ...(company   !== undefined  && { company:  company  || null }),
        ...(photoUrl  !== undefined  && { photoUrl: photoUrl || null }),
      },
      select: PROFILE_SELECT,
    });
    res.status(200).json({ success: true, message: 'Profile updated successfully', data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as JwtPayload)['id'] as string;
    const { password } = req.body as { password?: string };

    if (password) {
      const bcrypt = await import('bcryptjs');
      const tenant = await prisma.tenant.findUnique({ where: { id: userId } });
      if (!tenant) { res.status(404).json({ success: false, message: 'User not found' }); return; }
      const valid = await bcrypt.compare(password, tenant.passwordHash);
      if (!valid) { res.status(401).json({ success: false, message: 'Invalid password' }); return; }
    }

    await prisma.tenant.delete({ where: { id: userId } });
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
}
