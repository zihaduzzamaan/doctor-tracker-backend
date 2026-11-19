const http = require('http');

async function testCors(baseUrl, testOrigin) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + '/api/v1/auth/login');
    const req = http.request(
      url,
      {
        method: 'OPTIONS',
        headers: {
          'Origin': testOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      },
      (res) => {
        resolve({
          statusCode: res.statusCode,
          headers: {
            'access-control-allow-origin': res.headers['access-control-allow-origin'],
            'access-control-allow-credentials': res.headers['access-control-allow-credentials'],
            'access-control-allow-methods': res.headers['access-control-allow-methods'],
            'access-control-allow-headers': res.headers['access-control-allow-headers'],
            'vary': res.headers['vary'],
          },
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('=== CORS SECURITY & PREFLIGHT VERIFICATION ===');
  const origins = [
    'http://localhost:3000',
    'https://doctor-tracker.vercel.app',
    'https://evil-untrusted-domain.com',
  ];

  for (const origin of origins) {
    console.log(`\nTesting Origin: ${origin}`);
    const res = await testCors('http://localhost:5000', origin);
    console.log('Response Status:', res.statusCode);
    console.log('CORS Headers:', res.headers);
  }
}

run().catch(console.error);
