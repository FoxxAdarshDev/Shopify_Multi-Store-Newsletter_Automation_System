import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'member';
    permissions?: Record<string, boolean>;
  };
  sessionId?: string;
}

export const authenticateSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return res.status(401).json({ message: 'No session found' });
    }

    const sessionData = await storage.getSession(sessionId);
    if (!sessionData) {
      res.clearCookie('sessionId');
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    const user = await storage.getUser(sessionData.userId);
    if (!user || !user.isActive) {
      res.clearCookie('sessionId');
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as 'admin' | 'member',
      permissions: user.permissions as Record<string, boolean> || {}
    };
    req.sessionId = sessionId;

    // Update last login time
    await storage.updateUser(user.id, { lastLoginAt: new Date() });

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === 'admin') {
      return next(); // Admin has all permissions
    }
    
    if (!req.user?.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({ message: `Permission '${permission}' required` });
    }
    next();
  };
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.sessionId;
    
    if (!sessionId) {
      return next();
    }

    const sessionData = await storage.getSession(sessionId);
    if (!sessionData) {
      res.clearCookie('sessionId');
      return next();
    }

    const user = await storage.getUser(sessionData.userId);
    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'member',
        permissions: user.permissions as Record<string, boolean> || {}
      };
      req.sessionId = sessionId;
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};