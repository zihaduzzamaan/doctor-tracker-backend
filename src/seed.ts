import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Doctor } from './models/Doctor.js';
import { Patient } from './models/Patient.js';

const DOCTORS_SEED_DATA = [
  {
    doctor_name: 'Dr. Sarah Jenkins',
    specialization: 'Cardiology',
    hospital: 'Central Hospital',
    phone: '+1 (555) 234-5678',
    email: 'sarah.jenkins@clinic.com',
  },
  {
    doctor_name: 'Dr. Marcus Vance',
    specialization: 'Cardiology',
    hospital: 'Metropolitan Medical Center',
    phone: '+1 (555) 345-6789',
    email: 'marcus.vance@clinic.com',
  },
  {
    doctor_name: 'Dr. Elena Rostova',
    specialization: 'Neurology',
    hospital: 'Central Hospital',
    phone: '+1 (555) 456-7890',
    email: 'elena.rostova@clinic.com',
  },
  {
    doctor_name: 'Dr. David Kim',
    specialization: 'Neurology',
    hospital: 'North Wing Pavilion',
    phone: '+1 (555) 567-8901',
    email: 'david.kim@clinic.com',
  },
  {
    doctor_name: 'Dr. Maya Patel',
    specialization: 'Pediatrics',
    hospital: 'Central Hospital',
    phone: '+1 (555) 678-9012',
    email: 'maya.patel@clinic.com',
  },
  {
    doctor_name: 'Dr. James Wilson',
    specialization: 'Pediatrics',
    hospital: 'North Wing Pavilion',
    phone: '+1 (555) 789-0123',
    email: 'james.wilson@clinic.com',
  },
  {
    doctor_name: 'Dr. Rachel Chen',
    specialization: 'Orthopedics',
    hospital: 'Metropolitan Medical Center',
    phone: '+1 (555) 890-1234',
    email: 'rachel.chen@clinic.com',
  },
  {
    doctor_name: 'Dr. Robert Taylor',
    specialization: 'Orthopedics',
    hospital: 'Central Hospital',
    phone: '+1 (555) 901-2345',
    email: 'robert.taylor@clinic.com',
  },
  {
    doctor_name: 'Dr. Lisa Morales',
    specialization: 'Oncology',
    hospital: 'Metropolitan Medical Center',
    phone: '+1 (555) 012-3456',
    email: 'lisa.morales@clinic.com',
  },
  {
    doctor_name: 'Dr. Thomas Wright',
    specialization: 'Oncology',
    hospital: 'North Wing Pavilion',
    phone: '+1 (555) 123-4567',
    email: 'thomas.wright@clinic.com',
  },
];

const PATIENT_NAMES = [
  'Emma Watson', 'Liam Smith', 'Olivia Johnson', 'Noah Williams', 'Ava Brown',
  'Ethan Jones', 'Sophia Garcia', 'Mason Miller', 'Isabella Davis', 'Lucas Rodriguez',
  'Mia Martinez', 'Oliver Hernandez', 'Harper Lopez', 'Aiden Gonzalez', 'Evelyn Wilson',
  'Elijah Anderson', 'Abigail Thomas', 'James Taylor', 'Emily Moore', 'Benjamin Jackson',
  'Charlotte Martin', 'Alexander Lee', 'Amelia Perez', 'Henry Thompson', 'Ella White',
  'Sebastian Harris', 'Chloe Sanchez', 'Jack Clark', 'Victoria Ramirez', 'Owen Lewis',
  'Grace Robinson', 'Daniel Walker', 'Zoey Young', 'Matthew Allen', 'Penelope King',
  'Samuel Wright', 'Riley Scott', 'David Torres', 'Lily Nguyen', 'Joseph Hill'
];

const CONDITIONS = [
  'Arrhythmia', 'Hypertension', 'Migraine with Aura', 'Epilepsy', 'Asthma',
  'Acute Bronchitis', 'Fractured Fibula', 'Osteoarthritis', 'Lymphoma Stage I',
  'Early Stage Breast Carcinoma', 'Coronary Artery Disease', 'Concussion',
  'Juvenile Rheumatoid Arthritis', 'Spinal Stenosis', 'Post-Op Observation'
];

async function seed() {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  console.log('[Seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Doctor.deleteMany({}),
    Patient.deleteMany({}),
  ]);

  console.log('[Seed] Creating demo clinic administrator (admin@clinic.com)...');
  const admin = new User({
    email: 'admin@clinic.com',
    password: 'password123',
    name: 'Clinic Administrator',
    role: 'admin',
  });
  await admin.save();
  console.log('[Seed] Admin user created with ID:', admin._id);

  console.log('[Seed] Creating 10 medical practitioners...');
  const createdDoctors = [];
  for (const docData of DOCTORS_SEED_DATA) {
    const doc = new Doctor({
      ...docData,
      user_id: admin._id,
      active_patient_count: 0,
    });
    await doc.save();
    createdDoctors.push(doc);
  }
  console.log(`[Seed] ${createdDoctors.length} doctors registered.`);

  console.log('[Seed] Creating 40 clinical patient cases...');
  const statuses: Array<'admitted' | 'under_observation' | 'discharged'> = [
    'admitted', 'admitted', 'under_observation', 'admitted', 'discharged'
  ];
  const genders: Array<'male' | 'female'> = ['male', 'female'];

  const now = new Date();

  for (let i = 0; i < PATIENT_NAMES.length; i++) {
    const assignedDoctor = createdDoctors[i % createdDoctors.length];
    const status = statuses[i % statuses.length];
    const gender = genders[i % genders.length];
    const condition = CONDITIONS[i % CONDITIONS.length];

    // Distribute admissions over the past 6 months for realistic charts
    const daysAgo = Math.floor(Math.random() * 150);
    const admissionDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const patient = new Patient({
      doctor_id: assignedDoctor._id,
      user_id: admin._id,
      patient_name: PATIENT_NAMES[i],
      age: 18 + Math.floor(Math.random() * 65),
      gender,
      phone: `+1 (555) ${100 + i}-${2000 + i}`,
      condition,
      status,
      admission_date: admissionDate,
    });
    await patient.save();

    if (status !== 'discharged') {
      await Doctor.findByIdAndUpdate(assignedDoctor._id, {
        $inc: { active_patient_count: 1 },
      });
    }
  }

  console.log('[Seed] Successfully seeded 40 patients with realistic historical trends.');
  console.log('[Seed] Complete! Demo Credentials:');
  console.log('       Email:    admin@clinic.com');
  console.log('       Password: password123');

  await mongoose.disconnect();
  console.log('[Seed] Database disconnected.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
