const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function runPhase2Verification() {
  console.log('=== DOCTOR TRACKER: PHASE 2 IMPLEMENTATION VERIFICATION ===\n');

  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB Atlas successfully.');

  const db = mongoose.connection.db;
  const doctorsCol = db.collection('doctors');
  const patientsCol = db.collection('patients');

  // Step 1: Ensure Doctor.createdAt: -1 index is built
  console.log('\n--- Step 1: Synchronizing and Inspecting Doctor Indexes ---');
  await doctorsCol.createIndex({ createdAt: -1 });
  const indexes = await doctorsCol.indexes();
  console.log('Current Doctor indexes:');
  indexes.forEach(idx => {
    console.log(` - ${idx.name}: ${JSON.stringify(idx.key)}`);
  });

  const hasCreatedAtIndex = indexes.some(idx => idx.name === 'createdAt_-1' || (idx.key && idx.key.createdAt === -1));
  console.log(`\nVerified createdAt: -1 index exists: ${hasCreatedAtIndex ? 'YES' : 'NO'}`);

  // Step 2: Explain Q1 - Default Doctor List Sort
  console.log('\n--- Step 2: Query Plan Verification for Q1 (Doctor.find().sort({ createdAt: -1 })) ---');
  const explainResult = await doctorsCol.find({}).sort({ createdAt: -1 }).limit(50).explain('executionStats');

  const stats = explainResult.executionStats;
  let currentStage = stats.executionStages;
  let stagesChain = [];
  while (currentStage) {
    stagesChain.push(currentStage.stage);
    if (currentStage.indexName) {
      stagesChain[stagesChain.length - 1] += ` (${currentStage.indexName})`;
    }
    currentStage = currentStage.inputStage || (currentStage.inputStages && currentStage.inputStages[0]);
  }

  console.log('Execution Plan Pipeline:', stagesChain.join(' <- '));
  console.log(`Total Docs Examined: ${stats.totalDocsExamined}`);
  console.log(`Total Keys Examined: ${stats.totalKeysExamined}`);
  console.log(`Docs Returned: ${stats.nReturned}`);
  console.log(`Execution Time: ${stats.executionTimeMillis} ms`);

  const usesIndexScan = stagesChain.some(s => s.includes('IXSCAN') && s.includes('createdAt_-1'));
  const hasInMemSort = stagesChain.some(s => s.includes('SORT') && !s.includes('IXSCAN'));
  console.log(`Uses IXSCAN (createdAt_-1): ${usesIndexScan ? 'YES' : 'NO'}`);
  console.log(`In-memory SORT eliminated: ${!hasInMemSort ? 'YES' : 'NO'}`);

  // Step 3: Analytics Endpoint Logic Verification (Parallel Pattern)
  console.log('\n--- Step 3: Analytics Parallel Controller Execution Verification ---');
  const t0 = process.hrtime.bigint();
  const [doctorCount, patientAgg, doctorWorkload] = await Promise.all([
    doctorsCol.countDocuments(),
    patientsCol.aggregate([
      {
        $facet: {
          totalPatients: [{ $count: 'count' }],
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          conditionBreakdown: [
            {
              $group: {
                _id: '$condition',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 6 },
          ],
          intakeTrends: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m', date: '$admission_date' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 12 },
          ],
        },
      },
    ]).toArray(),
    doctorsCol.find({}, { projection: { doctor_name: 1, specialization: 1, active_patient_count: 1 } })
      .sort({ active_patient_count: -1 })
      .limit(8)
      .toArray(),
  ]);
  const t1 = process.hrtime.bigint();
  const elapsedMs = Number(t1 - t0) / 1e6;

  console.log(`Parallel query completed in: ${elapsedMs.toFixed(2)} ms`);
  console.log('Analytics Response Data Check:');
  console.log(` - totalDoctors: ${doctorCount}`);
  console.log(` - totalPatients: ${patientAgg[0]?.totalPatients?.[0]?.count}`);
  console.log(` - statusBreakdown categories: ${patientAgg[0]?.statusBreakdown?.length}`);
  console.log(` - conditionBreakdown items: ${patientAgg[0]?.conditionBreakdown?.length}`);
  console.log(` - intakeTrends intervals: ${patientAgg[0]?.intakeTrends?.length}`);
  console.log(` - doctorWorkload entries: ${doctorWorkload?.length}`);

  await mongoose.disconnect();
  console.log('\n=== PHASE 2 EMPIRICAL VERIFICATION COMPLETE ===');
}

runPhase2Verification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
