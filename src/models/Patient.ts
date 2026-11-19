import { Schema, model, Document, Types } from 'mongoose';

export interface IPatient extends Document {
  doctor_id: Types.ObjectId;
  user_id: Types.ObjectId;
  patient_name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  phone: string;
  condition: string;
  status: 'admitted' | 'under_observation' | 'discharged';
  admission_date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    doctor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patient_name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 150,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    condition: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['admitted', 'under_observation', 'discharged'],
      default: 'admitted',
      index: true,
    },
    admission_date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for doctor drawer lookups and workload isolation
patientSchema.index({ doctor_id: 1, status: 1 });

// Full-text search index across patient cases
patientSchema.index({
  patient_name: 'text',
  condition: 'text',
});

export const Patient = model<IPatient>('Patient', patientSchema);
