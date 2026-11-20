const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BASE_URL = 'http://localhost:5000';

function apiRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runPhase12Validation() {
  console.log('================================================================');
  console.log('PHASE 1.2: DATABASE EXECUTION-PLAN & CONCURRENCY VALIDATION');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const doctorsCol = db.collection('doctors');
  const patientsCol = db.collection('patients');

  // -------------------------------------------------------------
  // PART 1: INDEX METADATA & $indexStats ACCESS COUNTERS
  // -------------------------------------------------------------
  console.log('=== PART 1: COMPREHENSIVE INDEX METADATA & USAGE STATS ($indexStats) ===');

  console.log('\n--- DOCTORS COLLECTION INDEXES ---');
  const docIndexes = await doctorsCol.indexes();
  for (const idx of docIndexes) {
    console.log(JSON.stringify(idx));
  }

  console.log('\n--- DOCTORS INDEX USAGE ($indexStats) ---');
  try {
    const docStats = await doctorsCol.aggregate([{ $indexStats: {} }]).toArray();
    for (const s of docStats) {
      console.log(`- Index: ${s.name} | Ops: ${s.accesses?.ops || 0} | Since: ${s.accesses?.since}`);
    }
  } catch (err) {
    console.log('Index stats not available:', err.message);
  }

  console.log('\n--- PATIENTS COLLECTION INDEXES ---');
  const patIndexes = await patientsCol.indexes();
  for (const idx of patIndexes) {
    console.log(JSON.stringify(idx));
  }

  console.log('\n--- PATIENTS INDEX USAGE ($indexStats) ---');
  try {
    const patStats = await patientsCol.aggregate([{ $indexStats: {} }]).toArray();
    for (const s of patStats) {
      console.log(`- Index: ${s.name} | Ops: ${s.accesses?.ops || 0} | Since: ${s.accesses?.since}`);
    }
  } catch (err) {
    console.log('Index stats not available:', err.message);
  }

  // -------------------------------------------------------------
  // PART 2: RAW explain("executionStats") FOR CRITICAL QUERIES
  // -------------------------------------------------------------
  console.log('\n=== PART 2: RAW explain("executionStats") FOR ALL CRITICAL QUERIES ===');

  const sampleDoc = await doctorsCol.findOne();
  const sampleDocId = sampleDoc ? sampleDoc._id : null;

  // Query 1: Default Doctor list (no filter, sorted by createdAt: -1)
  console.log('\n[QUERY 1] Doctor Default List: find({}).sort({ createdAt: -1 }).limit(10)');
  const q1 = await doctorsCol.find({}).sort({ createdAt: -1 }).limit(10).explain('executionStats');
  printRawStats(q1);

  // Query 2: Doctor filter by specialization alone
  console.log('\n[QUERY 2] Doctor Filter by Specialization: find({ specialization: "Cardiology" })');
  const q2 = await doctorsCol.find({ specialization: 'Cardiology' }).explain('executionStats');
  printRawStats(q2);

  // Query 3: Doctor filter by hospital alone
  console.log('\n[QUERY 3] Doctor Filter by Hospital: find({ hospital: "Metropolitan General Hospital" })');
  const q3 = await doctorsCol.find({ hospital: 'Metropolitan General Hospital' }).explain('executionStats');
  printRawStats(q3);

  // Query 4: Doctor compound filter (hospital + specialization + sort createdAt: -1)
  console.log('\n[QUERY 4] Doctor Compound Filter: find({ hospital: "...", specialization: "..." }).sort({ createdAt: -1 })');
  const q4 = await doctorsCol.find({
    hospital: 'Metropolitan General Hospital',
    specialization: 'Cardiology'
  }).sort({ createdAt: -1 }).explain('executionStats');
  printRawStats(q4);

  // Query 5: Doctor text search
  console.log('\n[QUERY 5] Doctor Text Search: find({ $text: { $search: "Cardiology" } }).sort({ createdAt: -1 })');
  const q5 = await doctorsCol.find({ $text: { $search: 'Cardiology' } }).sort({ createdAt: -1 }).explain('executionStats');
  printRawStats(q5);

  // Query 6: Patient find by doctor_id alone (Prefix query: does it use doctor_id_1 or doctor_id_1_status_1?)
  console.log('\n[QUERY 6] Patient Prefix Query: find({ doctor_id: sampleDocId })');
  const q6 = await patientsCol.find({ doctor_id: sampleDocId }).explain('executionStats');
  printRawStats(q6);

  // Query 7: Patient drawer caseload: find({ doctor_id: sampleDocId, status: { $ne: "discharged" } })
  console.log('\n[QUERY 7] Patient Drawer Caseload: find({ doctor_id: sampleDocId, status: { $ne: "discharged" } })');
  const q7 = await patientsCol.find({ doctor_id: sampleDocId, status: { $ne: 'discharged' } }).explain('executionStats');
  printRawStats(q7);

  // Query 8: Patient search via unanchored regex (Actual Controller Code)
  console.log('\n[QUERY 8] Patient Unanchored Regex Search: find({ patient_name: { $regex: "Sarah", $options: "i" } })');
  const q8 = await patientsCol.find({ patient_name: { $regex: 'Sarah', $options: 'i' } }).sort({ admission_date: -1 }).limit(10).explain('executionStats');
  printRawStats(q8);

  // Query 9: Patient condition regex filter (Actual Controller Code)
  console.log('\n[QUERY 9] Patient Condition Regex Filter: find({ condition: { $regex: "Hypertension", $options: "i" } })');
  const q9 = await patientsCol.find({ condition: { $regex: 'Hypertension', $options: 'i' } }).sort({ admission_date: -1 }).limit(10).explain('executionStats');
  printRawStats(q9);

  // Query 10: Patient condition exact match (Alternative comparison)
  console.log('\n[QUERY 10] Patient Condition Exact Match: find({ condition: "Hypertension" })');
  const q10 = await patientsCol.find({ condition: 'Hypertension' }).explain('executionStats');
  printRawStats(q10);

  // Query 11: Patient count query for counter update: countDocuments({ doctor_id: sampleDocId, status: { $ne: "discharged" } })
  console.log('\n[QUERY 11] Patient Count Documents for Counter: countDocuments({ doctor_id: sampleDocId, status: { $ne: "discharged" } })');
  const q11 = await patientsCol.find({ doctor_id: sampleDocId, status: { $ne: 'discharged' } }).explain('executionStats');
  printRawStats(q11);

  // -------------------------------------------------------------
  // PART 3: EMPIRICAL CONCURRENCY TESTING (Race Conditions & Counter Integrity)
  // -------------------------------------------------------------
  console.log('\n=== PART 3: EMPIRICAL CONCURRENCY TESTING (Patient Counter Integrity) ===');

  // Authenticate to obtain token for API calls
  const loginRes = await apiRequest('POST', '/api/v1/auth/login', {
    email: 'admin@clinic.com',
    password: 'password123',
  });
  const token = loginRes.data?.data?.token;

  if (!token) {
    console.error('Failed to authenticate for concurrency tests');
    await mongoose.disconnect();
    return;
  }

  // Create an isolated test doctor
  const testDocRes = await apiRequest('POST', '/api/v1/doctors', {
    doctor_name: 'Dr. Concurrency Test Runner',
    specialization: 'Neurology',
    hospital: 'Metropolitan General Hospital',
    phone: '+1-555-0999',
    email: `concurrency.${Date.now()}@clinic.com`,
  }, token);

  const testDoc = testDocRes.data?.data;
  const testDocId = testDoc?._id;
  console.log(`Created isolated test doctor: ID=${testDocId}, Initial active_patient_count=${testDoc?.active_patient_count}`);

  // Test 3.1: 5 Concurrent Patient Creations (Testing Atomic Increment under Parallel Requests)
  console.log('\n--- Test 3.1: 5 Simultaneous Patient Admissions for Same Doctor ---');
  const patientCreationPromises = [];
  for (let i = 1; i <= 5; i++) {
    patientCreationPromises.push(
      apiRequest('POST', '/api/v1/patients', {
        patient_name: `Concurrent Inpatient ${i}`,
        age: 30 + i,
        gender: 'female',
        condition: 'Migraine',
        doctor_id: testDocId,
        status: 'admitted',
        phone: '+1-555-0100',
      }, token)
    );
  }

  const creationResults = await Promise.all(patientCreationPromises);
  const createdPatientIds = creationResults.map(r => r.data?.data?._id).filter(Boolean);
  console.log(`Dispatched 5 concurrent admissions. All completed HTTP status: ${creationResults.map(r => r.status).join(', ')}`);

  // Verify Doctor's active_patient_count vs Actual Active Documents in DB
  const docAfterCreations = await doctorsCol.findOne({ _id: new mongoose.Types.ObjectId(testDocId) });
  const actualActiveCount1 = await patientsCol.countDocuments({
    doctor_id: new mongoose.Types.ObjectId(testDocId),
    status: { $ne: 'discharged' }
  });

  console.log(`Result 3.1: Doctor active_patient_count = ${docAfterCreations.active_patient_count} | Actual Active Patients in DB = ${actualActiveCount1}`);
  console.log(`Consistency Verdict 3.1: ${docAfterCreations.active_patient_count === actualActiveCount1 ? 'CONSISTENT (Match)' : 'DESYNCHRONIZED (Race Condition Drift!)'}`);

  // Test 3.2: Simultaneous Updates / Discharges (Testing Race Conditions in updatePatient)
  console.log('\n--- Test 3.2: 3 Simultaneous Discharges for Same Doctor ---');
  if (createdPatientIds.length >= 3) {
    const dischargePromises = createdPatientIds.slice(0, 3).map(pId =>
      apiRequest('PUT', `/api/v1/patients/${pId}`, { status: 'discharged' }, token)
    );

    const dischargeResults = await Promise.all(dischargePromises);
    console.log(`Dispatched 3 concurrent discharges. All completed HTTP status: ${dischargeResults.map(r => r.status).join(', ')}`);

    const docAfterDischarges = await doctorsCol.findOne({ _id: new mongoose.Types.ObjectId(testDocId) });
    const actualActiveCount2 = await patientsCol.countDocuments({
      doctor_id: new mongoose.Types.ObjectId(testDocId),
      status: { $ne: 'discharged' }
    });

    console.log(`Result 3.2: Doctor active_patient_count = ${docAfterDischarges.active_patient_count} | Actual Active Patients in DB = ${actualActiveCount2}`);
    console.log(`Consistency Verdict 3.2: ${docAfterDischarges.active_patient_count === actualActiveCount2 ? 'CONSISTENT (Match)' : 'DESYNCHRONIZED (Race Condition Drift!)'}`);
  }

  // Cleanup isolated test records
  console.log('\n--- Cleanup: Removing Isolated Test Records ---');
  await patientsCol.deleteMany({ doctor_id: new mongoose.Types.ObjectId(testDocId) });
  await doctorsCol.deleteOne({ _id: new mongoose.Types.ObjectId(testDocId) });
  console.log('Cleaned up test doctor and patient records cleanly.');

  // -------------------------------------------------------------
  // PART 4: ANALYTICS DATABASE ENGINE LATENCY BENCHMARK
  // -------------------------------------------------------------
  console.log('\n=== PART 4: ANALYTICS DATABASE ENGINE LATENCY BENCHMARK ===');

  const pipeline = [
    {
      $facet: {
        totalPatients: [{ $count: 'count' }],
        statusBreakdown: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        conditionBreakdown: [{ $group: { _id: '$condition', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }],
        intakeTrends: [
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$admission_date' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $limit: 12 }
        ]
      }
    }
  ];

  // Measure 1: $facet execution time alone directly on DB
  const facetTimings = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await patientsCol.aggregate(pipeline).toArray();
    facetTimings.push(performance.now() - t0);
  }

  // Measure 2: Doctor.find().limit(8) execution time alone directly on DB
  const docWorkloadTimings = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await doctorsCol.find({}).project({ doctor_name: 1, specialization: 1, active_patient_count: 1 }).sort({ active_patient_count: -1 }).limit(8).toArray();
    docWorkloadTimings.push(performance.now() - t0);
  }

  // Measure 3: Parallel execution via Promise.all directly on DB
  const parallelTimings = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await Promise.all([
      doctorsCol.countDocuments(),
      patientsCol.aggregate(pipeline).toArray(),
      doctorsCol.find({}).project({ doctor_name: 1, specialization: 1, active_patient_count: 1 }).sort({ active_patient_count: -1 }).limit(8).toArray()
    ]);
    parallelTimings.push(performance.now() - t0);
  }

  // Measure 4: Sequential execution (as currently implemented in controller) directly on DB
  const sequentialTimings = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await Promise.all([
      doctorsCol.countDocuments(),
      patientsCol.aggregate(pipeline).toArray()
    ]);
    await doctorsCol.find({}).project({ doctor_name: 1, specialization: 1, active_patient_count: 1 }).sort({ active_patient_count: -1 }).limit(8).toArray();
    sequentialTimings.push(performance.now() - t0);
  }

  const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);

  console.log(`1. $facet Pipeline Alone (avg): ${avg(facetTimings)} ms`);
  console.log(`2. Top Doctors Query Alone (avg): ${avg(docWorkloadTimings)} ms`);
  console.log(`3. Sequential Execution (Current Controller Pattern avg): ${avg(sequentialTimings)} ms`);
  console.log(`4. Parallel Execution (Proposed Optimization avg): ${avg(parallelTimings)} ms`);
  console.log(`Measured Latency Delta (Direct DB Connection): ${(avg(sequentialTimings) - avg(parallelTimings)).toFixed(2)} ms`);

  await mongoose.disconnect();
  console.log('\nPhase 1.2 Validation Runner Completed Cleanly.');
}

function printRawStats(explainOutput) {
  const stats = explainOutput.executionStats;
  const plan = explainOutput.queryPlanner?.winningPlan || {};

  function findStage(p) {
    if (!p) return null;
    if (p.stage) return p.stage;
    if (p.inputStage) return findStage(p.inputStage);
    return null;
  }

  console.log(`  winningPlan: stage=${plan.stage}, inputStage=${plan.inputStage?.stage || 'none'}, indexName=${plan.inputStage?.indexName || plan.inputStage?.inputStage?.indexName || plan.indexName || 'none'}`);
  console.log(`  executionStats.nReturned: ${stats.nReturned}`);
  console.log(`  executionStats.totalKeysExamined: ${stats.totalKeysExamined}`);
  console.log(`  executionStats.totalDocsExamined: ${stats.totalDocsExamined}`);
  console.log(`  executionStats.executionTimeMillis: ${stats.executionTimeMillis} ms`);
}

runPhase12Validation().catch(console.error);
