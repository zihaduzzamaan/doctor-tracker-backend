import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please complete all required fields.',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Incorrect email or password. Please try again.',
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Incorrect email or password. Please try again.',
      });
      return;
    }

    const secret = process.env.JWT_SECRET || 'doctor_tracker_jwt_secret_dev_key';
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('[Auth Error]: Login failed with exception:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong on our end. Please try again later.',
    });
  }
}

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      res.status(404).json({
        success: false,
        message: "We couldn't find an account with these details.",
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[Auth Error]: Profile fetch failed:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong on our end. Please try again later.',
    });
  }
}
