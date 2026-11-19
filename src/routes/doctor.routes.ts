import { Router } from 'express';
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  doctorInputSchema,
} from '../controllers/doctor.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const doctorRouter = Router();

doctorRouter.use(authenticate);

doctorRouter.get('/', getDoctors);
doctorRouter.get('/:id', getDoctorById);
doctorRouter.post('/', validate(doctorInputSchema), createDoctor);
doctorRouter.put('/:id', validate(doctorInputSchema.partial()), updateDoctor);
doctorRouter.delete('/:id', deleteDoctor);
