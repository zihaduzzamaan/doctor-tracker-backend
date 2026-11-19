import { Request, Response } from 'express';
import { z } from 'zod';
import { Patient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { AuthRequest } from '../middleware/auth.js';

export const patientInputSchema = z.object({
  doctor_id: z.string().min(1, 'Assigned doctor is required'),
  patient_name: z.string().min(2, 'Patient name is required'),
  age: z.number().int().min(0).max(150),
  gender: z.enum(['male', 'female', 'other']),
  phone: z.string().min(5, 'Valid telephone number is required'),
  condition: z.string().min(2, 'Diagnosis/condition is required'),
  status: z.enum(['admitted', 'under_observation', 'discharged']).default('admitted'),
  admission_date: z.string().optional(),
});

export async function getPatients(req: Request, res: Response): Promise<void> {
  const { doctor_id, status, condition, search, startDate, endDate, page = '1', limit = '10' } = req.query;

  const query: Record<string, any> = {};

  if (doctor_id && typeof doctor_id === 'string' && doctor_id !== 'all') {
    query.doctor_id = doctor_id;
  }

  if (status && typeof status === 'string' && status !== 'all') {
    query.status = status;
  }

  if (condition && typeof condition === 'string' && condition !== 'all') {
    query.condition = condition;
  }

  if (search && typeof search === 'string' && search.trim()) {
    query.patient_name = { $regex: search.trim(), $options: 'i' };
  }

  if (startDate || endDate) {
    query.admission_date = {};
    if (startDate) query.admission_date.$gte = new Date(startDate as string);
    if (endDate) query.admission_date.$lte = new Date(endDate as string);
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [patients, total] = await Promise.all([
    Patient.find(query)
      .populate('doctor_id', 'doctor_name specialization hospital')
      .sort({ admission_date: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Patient.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: patients,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
}

export async function getPatientById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const patient = await Patient.findById(id).populate('doctor_id', 'doctor_name specialization hospital').lean();
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found' });
    return;
  }

  res.json({
    success: true,
    data: patient,
  });
}

export async function createPatient(req: AuthRequest, res: Response): Promise<void> {
  const doctor = await Doctor.findById(req.body.doctor_id);
  if (!doctor) {
    res.status(400).json({ success: false, message: 'Selected doctor does not exist' });
    return;
  }

  const patient = new Patient({
    ...req.body,
    user_id: req.user?.userId,
    admission_date: req.body.admission_date ? new Date(req.body.admission_date) : new Date(),
  });

  await patient.save();

  // Increment active patient count on the assigned doctor
  if (patient.status !== 'discharged') {
    await Doctor.findByIdAndUpdate(doctor._id, { $inc: { active_patient_count: 1 } });
  }

  res.status(201).json({
    success: true,
    data: patient,
  });
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const existing = await Patient.findById(id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Patient not found' });
    return;
  }

  const previousDoctorId = existing.doctor_id.toString();
  const previousStatus = existing.status;

  const updated = await Patient.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updated) {
    res.status(404).json({ success: false, message: 'Patient not found' });
    return;
  }

  // Recalculate counts if doctor changed or status changed
  const newDoctorId = updated.doctor_id.toString();
  const newStatus = updated.status;

  if (previousDoctorId !== newDoctorId || previousStatus !== newStatus) {
    // Refresh counts for affected doctors
    const [countPrev, countNew] = await Promise.all([
      Patient.countDocuments({ doctor_id: previousDoctorId, status: { $ne: 'discharged' } }),
      Patient.countDocuments({ doctor_id: newDoctorId, status: { $ne: 'discharged' } }),
    ]);

    await Promise.all([
      Doctor.findByIdAndUpdate(previousDoctorId, { active_patient_count: countPrev }),
      Doctor.findByIdAndUpdate(newDoctorId, { active_patient_count: countNew }),
    ]);
  }

  res.json({
    success: true,
    data: updated,
  });
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const patient = await Patient.findByIdAndDelete(id);
  if (!patient) {
    res.status(404).json({ success: false, message: 'Patient not found' });
    return;
  }

  // Decrement doctor's active patient count if patient was active
  if (patient.status !== 'discharged') {
    await Doctor.findByIdAndUpdate(patient.doctor_id, {
      $inc: { active_patient_count: -1 },
    });
  }

  res.json({
    success: true,
    message: 'Patient record deleted successfully',
  });
}
