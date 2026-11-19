const http = require('http');

async function sendAuthRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      'http://localhost:5000/api/v1/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Origin': 'http://localhost:3000',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== AUTHENTICATION DIAGNOSIS & STABILITY VERIFICATION ===\n');

  // Test 1: Valid credentials
  console.log('Test 1: Valid Login (admin@clinic.com / password123)');
  const res1 = await sendAuthRequest({ email: 'admin@clinic.com', password: 'password123' });
  console.log('Status:', res1.status);
  console.log('Token Returned:', !!res1.body.data?.token);
  console.log('User Role:', res1.body.data?.user?.role);

  // Test 2: Invalid password
  console.log('\nTest 2: Invalid Password');
  const res2 = await sendAuthRequest({ email: 'admin@clinic.com', password: 'wrongpassword' });
  console.log('Status:', res2.status);
  console.log('Response:', res2.body);

  // Test 3: Non-existent email
  console.log('\nTest 3: Non-Existent User');
  const res3 = await sendAuthRequest({ email: 'ghost@clinic.com', password: 'password123' });
  console.log('Status:', res3.status);
  console.log('Response:', res3.body);

  // Test 4: Malformed payload (empty object)
  console.log('\nTest 4: Malformed Payload ({})');
  const res4 = await sendAuthRequest({});
  console.log('Status:', res4.status);
  console.log('Response:', res4.body);

  // Test 5: Case-insensitivity (ADMIN@CLINIC.COM)
  console.log('\nTest 5: Uppercase Email (ADMIN@CLINIC.COM)');
  const res5 = await sendAuthRequest({ email: 'ADMIN@CLINIC.COM', password: 'password123' });
  console.log('Status:', res5.status);
  console.log('Token Returned:', !!res5.body.data?.token);
}

run().catch(console.error);
