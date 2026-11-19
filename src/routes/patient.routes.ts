import { Router } from 'express';
import {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  patientInputSchema,
} from '../controllers/patient.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const patientRouter = Router();

patientRouter.use(authenticate);

patientRouter.get('/', getPatients);
patientRouter.get('/:id', getPatientById);
patientRouter.post('/', validate(patientInputSchema), createPatient);
patientRouter.put('/:id', validate(patientInputSchema.partial()), updatePatient);
patientRouter.delete('/:id', deletePatient);
