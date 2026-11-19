import { Request, Response } from 'express';
import { z } from 'zod';
import { Patient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { AuthRequest } from '../middleware/auth.js';

export const patientInputSchema = z.object({
  doctor_id: z.string().min(1, 'Assigned doctor is required'),
  patient_name: z.string().min(2, 'Patient name is required'),
  age: z.number().int().min(0).max(150),
  gender: z.preprocess((val) => (typeof val === 'string' ? val.toLowerCase() : val), z.enum(['male', 'female', 'other'])),
  phone: z.string().min(3).optional().default('+1 (555) 010-0000'),
  condition: z.string().min(2, 'Diagnosis/condition is required'),
  status: z
    .enum(['admitted', 'under_observation', 'observation', 'discharged'])
    .default('admitted'),
  admission_date: z.string().optional(),
  notes: z.string().optional(),
});

export async function getPatients(req: Request, res: Response): Promise<void> {
  try {
    const { doctor_id, status, condition, search, startDate, endDate, page = '1', limit = '10' } = req.query;

    const query: Record<string, any> = {};

    if (doctor_id && typeof doctor_id === 'string' && doctor_id !== 'all') {
      query.doctor_id = doctor_id;
    }

    if (status && typeof status === 'string' && status !== 'all') {
      if (status === 'observation' || status === 'under_observation') {
        query.status = { $in: ['observation', 'under_observation'] };
      } else {
        query.status = status;
      }
    }

    if (condition && typeof condition === 'string' && condition !== 'all') {
      query.condition = { $regex: condition.trim(), $options: 'i' };
    }

    if (search && typeof search === 'string' && search.trim()) {
      query.patient_name = { $regex: search.trim(), $options: 'i' };
    }

    if (startDate || endDate) {
      query.admission_date = {};
      if (startDate) query.admission_date.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.admission_date.$lte = end;
      }
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
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Patient Controller Error - getPatients]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve patient records' });
  }
}

export async function getPatientById(req: Request, res: Response): Promise<void> {
  try {
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
  } catch (err) {
    console.error('[Patient Controller Error - getPatientById]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve patient details' });
  }
}

export async function createPatient(req: AuthRequest, res: Response): Promise<void> {
  try {
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
  } catch (err) {
    console.error('[Patient Controller Error - createPatient]:', err);
    res.status(500).json({ success: false, message: 'Failed to record patient admission' });
  }
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await Patient.findById(id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    const previousDoctorId = existing.doctor_id?.toString();
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
    const newDoctorId = updated.doctor_id?.toString();
    const newStatus = updated.status;

    if (previousDoctorId !== newDoctorId || previousStatus !== newStatus) {
      const doctorsToUpdate = new Set<string>();
      if (previousDoctorId) doctorsToUpdate.add(previousDoctorId);
      if (newDoctorId) doctorsToUpdate.add(newDoctorId);

      for (const docId of doctorsToUpdate) {
        const activeCount = await Patient.countDocuments({
          doctor_id: docId,
          status: { $ne: 'discharged' },
        });
        await Doctor.findByIdAndUpdate(docId, { active_patient_count: activeCount });
      }
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error('[Patient Controller Error - updatePatient]:', err);
    res.status(500).json({ success: false, message: 'Failed to update patient record' });
  }
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const patient = await Patient.findByIdAndDelete(id);
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    // Decrement doctor's active patient count if patient was active
    if (patient.status !== 'discharged') {
      const activeCount = await Patient.countDocuments({
        doctor_id: patient.doctor_id,
        status: { $ne: 'discharged' },
      });
      await Doctor.findByIdAndUpdate(patient.doctor_id, {
        active_patient_count: activeCount,
      });
    }

    res.json({
      success: true,
      message: 'Patient record deleted successfully',
    });
  } catch (err) {
    console.error('[Patient Controller Error - deletePatient]:', err);
    res.status(500).json({ success: false, message: 'Failed to delete patient record' });
  }
}
