const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runExplain() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas host:', mongoose.connection.host);

  const db = mongoose.connection.db;
  const doctorsCol = db.collection('doctors');
  const patientsCol = db.collection('patients');

  // List existing indexes
  console.log('\n--- DOCTORS INDEXES ---');
  const docIndexes = await doctorsCol.indexes();
  for (const idx of docIndexes) {
    console.log(`- Name: ${idx.name}, Key: ${JSON.stringify(idx.key)}`);
  }

  console.log('\n--- PATIENTS INDEXES ---');
  const patIndexes = await patientsCol.indexes();
  for (const idx of patIndexes) {
    console.log(`- Name: ${idx.name}, Key: ${JSON.stringify(idx.key)}`);
  }

  // 1. Text search on doctors
  console.log('\n--- EXPLAIN: Doctors text search ---');
  const docSearchExplain = await doctorsCol.find(
    { $text: { $search: 'Cardiology' } }
  ).explain('executionStats');
  console.log({
    stage: docSearchExplain.executionStats.executionStages.stage,
    totalKeysExamined: docSearchExplain.executionStats.totalKeysExamined,
    totalDocsExamined: docSearchExplain.executionStats.totalDocsExamined,
    nReturned: docSearchExplain.executionStats.nReturned,
    executionTimeMillis: docSearchExplain.executionStats.executionTimeMillis
  });

  // 2. Compound filter on doctors: status + specialization
  console.log('\n--- EXPLAIN: Doctors status + specialization ---');
  const docFilterExplain = await doctorsCol.find(
    { status: 'active', specialization: 'Cardiology' }
  ).explain('executionStats');
  console.log({
    stage: docFilterExplain.executionStats.executionStages.stage,
    inputStage: docFilterExplain.executionStats.executionStages.inputStage ? docFilterExplain.executionStats.executionStages.inputStage.stage : undefined,
    indexName: docFilterExplain.executionStats.executionStages.inputStage ? docFilterExplain.executionStats.executionStages.inputStage.indexName : undefined,
    totalKeysExamined: docFilterExplain.executionStats.totalKeysExamined,
    totalDocsExamined: docFilterExplain.executionStats.totalDocsExamined,
    nReturned: docFilterExplain.executionStats.nReturned,
    executionTimeMillis: docFilterExplain.executionStats.executionTimeMillis
  });

  // 3. Patients: doctor_id + status compound index
  console.log('\n--- EXPLAIN: Patients doctor_id + status ---');
  const aDoctor = await doctorsCol.findOne();
  const patDocExplain = await patientsCol.find(
    { doctor_id: aDoctor._id, status: 'admitted' }
  ).explain('executionStats');
  console.log({
    stage: patDocExplain.executionStats.executionStages.stage,
    inputStage: patDocExplain.executionStats.executionStages.inputStage ? patDocExplain.executionStats.executionStages.inputStage.stage : undefined,
    indexName: patDocExplain.executionStats.executionStages.inputStage ? patDocExplain.executionStats.executionStages.inputStage.indexName : undefined,
    totalKeysExamined: patDocExplain.executionStats.totalKeysExamined,
    totalDocsExamined: patDocExplain.executionStats.totalDocsExamined,
    nReturned: patDocExplain.executionStats.nReturned,
    executionTimeMillis: patDocExplain.executionStats.executionTimeMillis
  });

  // 4. Patients: status + admission_date compound index
  console.log('\n--- EXPLAIN: Patients status + admission_date ---');
  const patStatusDateExplain = await patientsCol.find(
    { status: 'admitted' }
  ).sort({ admission_date: -1 }).explain('executionStats');
  console.log({
    stage: patStatusDateExplain.executionStats.executionStages.stage,
    inputStage: patStatusDateExplain.executionStats.executionStages.inputStage ? patStatusDateExplain.executionStats.executionStages.inputStage.stage : undefined,
    indexName: patStatusDateExplain.executionStats.executionStages.inputStage ? patStatusDateExplain.executionStats.executionStages.inputStage.indexName : undefined,
    totalKeysExamined: patStatusDateExplain.executionStats.totalKeysExamined,
    totalDocsExamined: patStatusDateExplain.executionStats.totalDocsExamined,
    nReturned: patStatusDateExplain.executionStats.nReturned,
    executionTimeMillis: patStatusDateExplain.executionStats.executionTimeMillis
  });

  // 5. Benchmark: Analytics pipeline timing
  console.log('\n--- BENCHMARK: Analytics Single-Pass Pipeline Timing ---');
  const pipeline = [
    {
      $facet: {
        kpis: [
          {
            $group: {
              _id: null,
              totalPatients: { $sum: 1 },
              activePatients: {
                $sum: {
                  $cond: [{ $in: ['$status', ['admitted', 'observation', 'under_observation']] }, 1, 0]
                }
              },
              dischargedPatients: {
                $sum: { $cond: [{ $eq: ['$status', 'discharged'] }, 1, 0] }
              }
            }
          }
        ],
        conditionsDistribution: [
          { $group: { _id: '$condition', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        admissionsTimeline: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$admission_date' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ];

  const timings = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await patientsCol.aggregate(pipeline).toArray();
    const duration = performance.now() - start;
    timings.push(duration);
  }
  const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
  console.log('Sample runs (ms):', timings.map(t => t.toFixed(2)));
  console.log('Average Execution Time (ms):', avgTiming.toFixed(2));

  await mongoose.disconnect();
  console.log('\nDisconnected cleanly.');
}

runExplain().catch(console.error);
