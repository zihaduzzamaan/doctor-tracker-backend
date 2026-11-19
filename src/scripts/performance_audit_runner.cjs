const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runAudit() {
  console.log('================================================================');
  console.log('DOCTOR TRACKER: EMPIRICAL PERFORMANCE & DATABASE AUDIT RUNNER');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const doctorsCol = db.collection('doctors');
  const patientsCol = db.collection('patients');

  const docCount = await doctorsCol.countDocuments();
  const patCount = await patientsCol.countDocuments();
  console.log(`[DATASET PROFILE] Doctors Collection: ${docCount} documents, Patients Collection: ${patCount} documents`);

  // Section 1: Detailed Index Analysis
  console.log('\n--- SECTION 1: DATABASE INDEX INVENTORY & SPECIFICATIONS ---');
  const docIndexes = await doctorsCol.indexes();
  console.log('\nDoctors Indexes:');
  for (const idx of docIndexes) {
    console.log(`- ${idx.name}: key=${JSON.stringify(idx.key)}, unique=${!!idx.unique}, sparse=${!!idx.sparse}`);
  }

  const patIndexes = await patientsCol.indexes();
  console.log('\nPatients Indexes:');
  for (const idx of patIndexes) {
    console.log(`- ${idx.name}: key=${JSON.stringify(idx.key)}, unique=${!!idx.unique}, sparse=${!!idx.sparse}`);
  }

  // Section 2: Query Execution Plans (explain('executionStats'))
  console.log('\n--- SECTION 2: QUERY EXECUTION PLANS (explain: executionStats) ---');

  // Test 2.1: Doctor Listing with Default Sort
  console.log('\n[TEST 2.1] Doctors: Default Sort (createdAt: -1)');
  const docListPlan = await doctorsCol.find({}).sort({ createdAt: -1 }).limit(10).explain('executionStats');
  printPlanSummary(docListPlan);

  // Test 2.2: Doctor Text Search vs Sort Conflict
  console.log('\n[TEST 2.2] Doctors: Text Search with Sort (createdAt: -1)');
  const docTextSearchPlan = await doctorsCol.find({ $text: { $search: 'Cardiology' } }).sort({ createdAt: -1 }).limit(10).explain('executionStats');
  printPlanSummary(docTextSearchPlan);

  // Test 2.3: Doctor Hospital + Specialization Compound Filter
  console.log('\n[TEST 2.3] Doctors: Hospital + Specialization + Sort');
  const docCompPlan = await doctorsCol.find({
    hospital: 'Metropolitan General Hospital',
    specialization: 'Cardiology'
  }).sort({ createdAt: -1 }).limit(10).explain('executionStats');
  printPlanSummary(docCompPlan);

  // Test 2.4: Patient Search via Regex (The ACTUAL implementation in patient.controller.ts)
  console.log('\n[TEST 2.4] Patients: Unanchored Regex Search (Actual Controller Code: patient_name: { $regex: ... })');
  const patRegexPlan = await patientsCol.find({
    patient_name: { $regex: 'Sarah', $options: 'i' }
  }).sort({ admission_date: -1 }).limit(10).explain('executionStats');
  printPlanSummary(patRegexPlan);

  // Test 2.5: Patient Search via Text Index (Alternative)
  console.log('\n[TEST 2.5] Patients: Text Search (Alternative: $text)');
  const patTextPlan = await patientsCol.find({
    $text: { $search: 'Sarah' }
  }).sort({ admission_date: -1 }).limit(10).explain('executionStats');
  printPlanSummary(patTextPlan);

  // Test 2.6: Patient Condition Filter via Regex (Actual Controller Code)
  console.log('\n[TEST 2.6] Patients: Condition Regex Filter (Actual Controller Code: condition: { $regex: ... })');
  const patCondRegexPlan = await patientsCol.find({
    condition: { $regex: 'Hypertension', $options: 'i' }
  }).sort({ admission_date: -1 }).limit(10).explain('executionStats');
  printPlanSummary(patCondRegexPlan);

  // Test 2.7: Patient Doctor Drawer Lookup (doctor_id + status)
  console.log('\n[TEST 2.7] Patients: Doctor Drawer Caseload Query (doctor_id + status)');
  const aDoctor = await doctorsCol.findOne();
  const patDrawerPlan = await patientsCol.find({
    doctor_id: aDoctor._id,
    status: { $ne: 'discharged' }
  }).explain('executionStats');
  printPlanSummary(patDrawerPlan);

  // Test 2.8: Patient Status + Date Range Filter
  console.log('\n[TEST 2.8] Patients: Status + Date Range (admission_date: { $gte, $lte })');
  const patDatePlan = await patientsCol.find({
    status: 'admitted',
    admission_date: { $gte: new Date('2024-01-01'), $lte: new Date('2027-12-31') }
  }).sort({ admission_date: -1 }).limit(10).explain('executionStats');
  printPlanSummary(patDatePlan);

  // Section 3: Aggregation Pipeline Profiling
  console.log('\n--- SECTION 3: AGGREGATION PIPELINE PROFILING (Analytics $facet) ---');
  const pipeline = [
    {
      $facet: {
        totalPatients: [{ $count: 'count' }],
        statusBreakdown: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        conditionBreakdown: [
          { $group: { _id: '$condition', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 }
        ],
        intakeTrends: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$admission_date' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } },
          { $limit: 12 }
        ]
      }
    }
  ];

  const aggExplain = await patientsCol.aggregate(pipeline).explain('executionStats');
  console.log('Aggregation Explain Summary:');
  console.log(`- Stages in winning plan: ${JSON.stringify(aggExplain.stages?.map(s => Object.keys(s)[0]) || aggExplain.executionStats?.executionStages?.stage)}`);
  console.log(`- Execution Time (ms): ${aggExplain.executionStats?.executionTimeMillis || aggExplain.stages?.[0]?.$cursor?.executionStats?.executionTimeMillis || 'N/A'}`);

  // Multi-run benchmark of the aggregation pipeline
  const aggTimings = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    await patientsCol.aggregate(pipeline).toArray();
    aggTimings.push(performance.now() - t0);
  }
  aggTimings.sort((a, b) => a - b);
  const medianAgg = aggTimings[Math.floor(aggTimings.length / 2)];
  console.log(`- 10-Run Benchmark (ms): Min=${aggTimings[0].toFixed(2)}, Median=${medianAgg.toFixed(2)}, Max=${aggTimings[aggTimings.length - 1].toFixed(2)}`);

  // Section 4: API Response Sizes and Network Serialization Profiling
  console.log('\n--- SECTION 4: API RESPONSE PROFILING (Payload Size & Serialization) ---');
  await profileApiEndpoint('/health');
  const loginRes = await profileApiPost('/api/v1/auth/login', { email: 'admin@clinic.com', password: 'password123' });
  const token = loginRes.data?.data?.token;

  if (token) {
    await profileApiEndpoint('/api/v1/auth/me', token);
    await profileApiEndpoint('/api/v1/analytics/summary', token);
    await profileApiEndpoint('/api/v1/doctors?limit=10', token);
    await profileApiEndpoint('/api/v1/doctors?limit=50', token);
    await profileApiEndpoint('/api/v1/patients?limit=10', token);
    await profileApiEndpoint('/api/v1/patients?limit=50', token);
    if (aDoctor) {
      await profileApiEndpoint(`/api/v1/doctors/${aDoctor._id}`, token);
    }
  }

  await mongoose.disconnect();
  console.log('\nAudit Runner Completed Cleanly.');
}

function printPlanSummary(explainOutput) {
  const stats = explainOutput.executionStats;
  const stage = stats.executionStages.stage;
  const inputStage = stats.executionStages.inputStage;
  const indexName = inputStage?.indexName || stats.executionStages.indexName;
  console.log(`  Winning Stage: ${stage}${inputStage ? ` <- [${inputStage.stage}]` : ''}`);
  if (indexName) console.log(`  Index Used: ${indexName}`);
  console.log(`  Keys Examined: ${stats.totalKeysExamined}`);
  console.log(`  Docs Examined: ${stats.totalDocsExamined}`);
  console.log(`  Docs Returned: ${stats.nReturned}`);
  console.log(`  Examined / Returned Ratio: ${stats.nReturned > 0 ? (stats.totalDocsExamined / stats.nReturned).toFixed(2) : 'N/A'}`);
  console.log(`  Execution Time: ${stats.executionTimeMillis} ms`);
}

function profileApiEndpoint(path, token = null) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const headers = { 'Origin': 'http://localhost:3000' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      `http://localhost:5000${path}`,
      { method: 'GET', headers },
      (res) => {
        let size = 0;
        let raw = '';
        res.on('data', (chunk) => {
          size += chunk.length;
          raw += chunk;
        });
        res.on('end', () => {
          const duration = performance.now() - t0;
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = null; }
          const itemCount = Array.isArray(parsed?.data) ? parsed.data.length : (parsed?.data?.patients ? parsed.data.patients.length : 1);
          console.log(`- ${path}: HTTP ${res.statusCode} | Duration: ${duration.toFixed(2)}ms | Raw Size: ${size} bytes | Items: ${itemCount}`);
          resolve({ status: res.statusCode, size, duration, data: parsed });
        });
      }
    );
    req.on('error', (err) => {
      console.error(`- ${path}: Error`, err.message);
      resolve({ error: err });
    });
    req.end();
  });
}

function profileApiPost(path, body) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Origin': 'http://localhost:3000'
    };

    const req = http.request(
      `http://localhost:5000${path}`,
      { method: 'POST', headers },
      (res) => {
        let size = 0;
        let raw = '';
        res.on('data', (chunk) => {
          size += chunk.length;
          raw += chunk;
        });
        res.on('end', () => {
          const duration = performance.now() - t0;
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = null; }
          resolve({ status: res.statusCode, size, duration, data: parsed });
        });
      }
    );
    req.on('error', (err) => resolve({ error: err }));
    req.write(payload);
    req.end();
  });
}

runAudit().catch(console.error);
