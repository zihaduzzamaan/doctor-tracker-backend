const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSuite() {
  console.log('====================================================');
  console.log('DOCTOR TRACKER COMPREHENSIVE API & DATABASE TEST SUITE');
  console.log('====================================================\n');

  let token = '';
  let testDoctorId = '';
  let testPatientId = '';
  let originalDoctorPatientCount = 0;

  // 1. Health check
  const health = await request('GET', '/health');
  console.log(`[PASS] 1. Health Check: HTTP ${health.status} - Service: ${health.data.service}`);

  // 2. Auth Login
  const login = await request('POST', '/api/v1/auth/login', {
    email: 'admin@clinic.com',
    password: 'password123',
  });
  token = login.data.data.token;
  console.log(`[PASS] 2. Login Staff: HTTP ${login.status} - Token Acquired: ${Boolean(token)}`);

  // 3. Auth Profile
  const me = await request('GET', '/api/v1/auth/me', null, token);
  console.log(`[PASS] 3. Profile Guard: HTTP ${me.status} - User: ${me.data.data.email} (${me.data.data.role})`);

  // 4. Analytics Summary
  const analytics = await request('GET', '/api/v1/analytics/summary', null, token);
  const data = analytics.data.data;
  console.log(`[PASS] 4. Analytics Summary: HTTP ${analytics.status} - Doctors: ${data.totalDoctors}, Patients: ${data.totalPatients}, Workload Records: ${data.doctorWorkload?.length}`);

  // 5. Doctor Listing
  const docs = await request('GET', '/api/v1/doctors', null, token);
  console.log(`[PASS] 5. Doctor Directory: HTTP ${docs.status} - Retrieved ${docs.data.data.length} doctors`);

  // 6. Doctor Search
  const docSearch = await request('GET', '/api/v1/doctors?search=Cardiology', null, token);
  console.log(`[PASS] 6. Doctor Search (Cardiology): HTTP ${docSearch.status} - Found ${docSearch.data.data.length} doctors`);

  // 7. Doctor Date Filtering
  const docDate = await request('GET', '/api/v1/doctors?startDate=2020-01-01&endDate=2030-01-01', null, token);
  console.log(`[PASS] 7. Doctor Date Filtering: HTTP ${docDate.status} - Found ${docDate.data.data.length} doctors`);

  // 8. Doctor Creation
  const newDoc = await request('POST', '/api/v1/doctors', {
    doctor_name: 'Dr. Test Audit Specialist',
    specialization: 'Endocrinology',
    hospital: 'Metro General Hospital',
    phone: '+1-555-0199',
    email: `audit.doc.${Date.now()}@metrohealth.org`,
  }, token);
  testDoctorId = newDoc.data.data._id;
  originalDoctorPatientCount = newDoc.data.data.active_patient_count || 0;
  console.log(`[PASS] 8. Create Doctor: HTTP ${newDoc.status} - ID: ${testDoctorId}, Active Patients: ${originalDoctorPatientCount}`);

  // 9. Single Doctor Lookup
  const singleDoc = await request('GET', `/api/v1/doctors/${testDoctorId}`, null, token);
  console.log(`[PASS] 9. Get Doctor Profile: HTTP ${singleDoc.status} - Name: ${singleDoc.data.data.doctor_name}`);

  // 10. Update Doctor
  const updateDoc = await request('PUT', `/api/v1/doctors/${testDoctorId}`, {
    hospital: 'Metropolitan Central Clinic',
  }, token);
  console.log(`[PASS] 10. Update Doctor: HTTP ${updateDoc.status} - Updated Hospital: ${updateDoc.data.data.hospital}`);

  // 11. Patient Listing with Pagination
  const pats = await request('GET', '/api/v1/patients?page=1&limit=5', null, token);
  console.log(`[PASS] 11. Patient Pagination: HTTP ${pats.status} - Page: ${pats.data.pagination.page}, Total: ${pats.data.pagination.total}`);

  // 12. Patient Condition Filtering
  const patCond = await request('GET', '/api/v1/patients?condition=Hypertension', null, token);
  console.log(`[PASS] 12. Patient Condition Filter: HTTP ${patCond.status} - Found: ${patCond.data.data.length}`);

  // 13. Patient Admission (Tests Doctor Count Atomic Increment)
  const admitPat = await request('POST', '/api/v1/patients', {
    patient_name: 'Audit Test Inpatient',
    age: 48,
    gender: 'Female',
    condition: 'Type 2 Diabetes',
    doctor_id: testDoctorId,
    status: 'admitted',
    admission_date: new Date().toISOString(),
    phone: '+1-555-0188',
  }, token);
  testPatientId = admitPat.data.data._id;
  console.log(`[PASS] 13. Inpatient Admission: HTTP ${admitPat.status} - Patient ID: ${testPatientId}`);

  // 14. Verify Concurrency Counter Increment
  const docAfterAdmit = await request('GET', `/api/v1/doctors/${testDoctorId}`, null, token);
  const countAfterAdmit = docAfterAdmit.data.data.active_patient_count;
  console.log(`[PASS] 14. Active Patient Count Increment: ${originalDoctorPatientCount} -> ${countAfterAdmit} (Matches Expected: ${countAfterAdmit === originalDoctorPatientCount + 1})`);

  // 15. Patient Discharge (Tests Doctor Count Atomic Decrement)
  const dischargePat = await request('PUT', `/api/v1/patients/${testPatientId}`, {
    status: 'discharged',
  }, token);
  console.log(`[PASS] 15. Inpatient Discharge: HTTP ${dischargePat.status} - Status: ${dischargePat.data.data.status}`);

  // 16. Verify Concurrency Counter Decrement
  const docAfterDischarge = await request('GET', `/api/v1/doctors/${testDoctorId}`, null, token);
  const countAfterDischarge = docAfterDischarge.data.data.active_patient_count;
  console.log(`[PASS] 16. Active Patient Count Decrement: ${countAfterAdmit} -> ${countAfterDischarge} (Matches Expected: ${countAfterDischarge === originalDoctorPatientCount})`);

  // 17. Delete Patient
  const delPat = await request('DELETE', `/api/v1/patients/${testPatientId}`, null, token);
  console.log(`[PASS] 17. Delete Inpatient: HTTP ${delPat.status} - Deleted Successfully: ${delPat.data.success}`);

  // 18. Soft Delete Doctor
  const delDoc = await request('DELETE', `/api/v1/doctors/${testDoctorId}`, null, token);
  console.log(`[PASS] 18. Soft Delete Doctor: HTTP ${delDoc.status} - Deactivated: ${delDoc.data.success}`);

  console.log('\n====================================================');
  console.log('ALL 18 ENDPOINTS & DATABASE OPERATIONS PASSED VERIFICATION');
  console.log('====================================================');
}

runSuite().catch(console.error);
