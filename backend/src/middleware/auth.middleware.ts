import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { prisma } from '../config/db';
import { toSafeUser } from '../utils/sanitize';
import { AppError } from './error.middleware';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication token required', 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(401, 'Authentication token required', 'UNAUTHORIZED');
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      throw new AppError(401, 'User account not found', 'UNAUTHORIZED');
    }

    req.user = toSafeUser(user);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, 'Invalid or expired authentication token', 'UNAUTHORIZED'));
  }
}
