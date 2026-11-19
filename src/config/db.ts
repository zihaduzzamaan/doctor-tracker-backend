import mongoose from 'mongoose';

export async function connectDB(uri?: string): Promise<void> {
  const mongoURI = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/doctor_tracker';

  try {
    const conn = await mongoose.connect(mongoURI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.error('[MongoDB] Connection failure:', error);
    process.exit(1);
  }
}
