import { Request, Response } from 'express';
import { z } from 'zod';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { AuthRequest } from '../middleware/auth.js';

export const doctorInputSchema = z.object({
  doctor_name: z.string().min(2, 'Doctor name must be at least 2 characters'),
  specialization: z.string().min(2, 'Specialization is required'),
  hospital: z.string().min(2, 'Hospital is required'),
  phone: z.string().min(5, 'Valid contact number is required'),
  email: z.string().email('Invalid email address'),
});

export async function getDoctors(req: Request, res: Response): Promise<void> {
  const { search, specialization, hospital, page = '1', limit = '10' } = req.query;

  const query: Record<string, any> = {};

  if (search && typeof search === 'string' && search.trim()) {
    query.$text = { $search: search.trim() };
  }

  if (specialization && typeof specialization === 'string' && specialization !== 'all') {
    query.specialization = specialization;
  }

  if (hospital && typeof hospital === 'string' && hospital !== 'all') {
    query.hospital = hospital;
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [doctors, total] = await Promise.all([
    Doctor.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Doctor.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: doctors,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}

export async function getDoctorById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const doctor = await Doctor.findById(id).lean();
  if (!doctor) {
    res.status(404).json({ success: false, message: 'Doctor not found' });
    return;
  }

  const patients = await Patient.find({ doctor_id: id }).sort({ admission_date: -1 }).lean();

  res.json({
    success: true,
    data: {
      ...doctor,
      patients,
    },
  });
}

export async function createDoctor(req: AuthRequest, res: Response): Promise<void> {
  const existing = await Doctor.findOne({ email: req.body.email });
  if (existing) {
    res.status(409).json({ success: false, message: 'Doctor with this email already exists' });
    return;
  }

  const doctor = new Doctor({
    ...req.body,
    user_id: req.user?.userId,
  });

  await doctor.save();

  res.status(201).json({
    success: true,
    data: doctor,
  });
}

export async function updateDoctor(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const doctor = await Doctor.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!doctor) {
    res.status(404).json({ success: false, message: 'Doctor not found' });
    return;
  }

  res.json({
    success: true,
    data: doctor,
  });
}

export async function deleteDoctor(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const doctor = await Doctor.findByIdAndDelete(id);
  if (!doctor) {
    res.status(404).json({ success: false, message: 'Doctor not found' });
    return;
  }

  // Delete all patients assigned to this doctor
  await Patient.deleteMany({ doctor_id: id });

  res.json({
    success: true,
    message: 'Doctor and associated patient records removed successfully',
  });
}
