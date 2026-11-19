import { Schema, model, Document, Types } from 'mongoose';

export interface IDoctor extends Document {
  user_id?: Types.ObjectId;
  doctor_name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  bio?: string;
  active_patient_count: number;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    doctor_name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    hospital: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      default: '+1 (555) 019-2834',
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    bio: {
      type: String,
      default: '',
      trim: true,
    },
    active_patient_count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound index for multi-field filtering & sorting
doctorSchema.index({ hospital: 1, specialization: 1, createdAt: -1 });

// Full-text search index across practitioner details
doctorSchema.index({
  doctor_name: 'text',
  specialization: 'text',
  hospital: 'text',
});

export const Doctor = model<IDoctor>('Doctor', doctorSchema);
