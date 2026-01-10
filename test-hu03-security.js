/**
 * HU03 Security Tests - Password Quality Validation
 * Script de pruebas automatizadas para validar la implementación de calidad de contraseñas
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000/user/create';

let passed = 0;
let failed = 0;
let total = 0;

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Función para hacer peticiones
async function testPassword(testName, username, email, password, expectedStatus, description = '') {
  total++;
  process.stdout.write(`Testing: ${testName} ... `);

  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        email,
        password,
        answerSecret: 'secret123',
        role: 'STUDENT_FREE',
      }),
    });

    const status = response.status;
    const body = await response.text();

    if (status === expectedStatus) {
      console.log(`${colors.green}✓ PASS${colors.reset} (HTTP ${status})`);
      passed++;
    } else {
      console.log(`${colors.red}✗ FAIL${colors.reset} (Expected ${expectedStatus}, got ${status})`);
      if (body && body.length < 200) {
        console.log(`  Response: ${body.substring(0, 100)}`);
      }
      failed++;
    }
  } catch (error) {
    console.log(`${colors.red}✗ ERROR${colors.reset} - ${error.message}`);
    failed++;
  }
}

// Main test runner
async function runTests() {
  console.log('═'.repeat(70));
  console.log('🔴 HU03 SECURITY TESTS - Password Quality Validation');
  console.log('═'.repeat(70));
  console.log(`Backend: ${BASE_URL}\n`);

  // 1. REGEX VALIDATION TESTS
  console.log(`${colors.yellow}[1] REGEX VALIDATION TESTS${colors.reset}`);
  await testPassword('Too short (5 chars)', 'user1', 'user1@test.com', 'Abc1!', 400);
  await testPassword('No uppercase', 'user2', 'user2@test.com', 'password123!', 400);
  await testPassword('No lowercase', 'user3', 'user3@test.com', 'PASSWORD123!', 400);
  await testPassword('No number', 'user4', 'user4@test.com', 'Password!', 400);
  await testPassword('No special char', 'user5', 'user5@test.com', 'Password123', 400);
  await testPassword('Valid password', `validuser${Date.now()}`, `valid${Date.now()}@test.com`, 'SecurePass123!', 201);

  console.log('');

  // 2. ANTI-USERNAME TESTS
  console.log(`${colors.yellow}[2] ANTI-USERNAME TESTS${colors.reset}`);
  await testPassword('Username in password (alex)', 'alex', 'alex@test.com', 'Alex123!Pass', 400);
  await testPassword('Username case-insensitive (john)', 'john', 'john@test.com', 'JoHnPassword123!', 400);
  await testPassword('Username at start', 'maria', 'maria@test.com', 'Maria123!Secure', 400);

  console.log('');

  // 3. SEQUENTIAL NUMBER TESTS
  console.log(`${colors.yellow}[3] SEQUENTIAL NUMBER TESTS${colors.reset}`);
  await testPassword('Ascending (123456)', 'user6', 'user6@test.com', 'Pass123456!', 400);
  await testPassword('Ascending (234567)', 'user7', 'user7@test.com', 'Pass234567!', 400);
  await testPassword('Descending (987654)', 'user8', 'user8@test.com', 'Pass987654!', 400);
  await testPassword('Repetitive (1111)', 'user9', 'user9@test.com', 'Pass1111!', 400);
  await testPassword('Repetitive (2222)', 'user10', 'user10@test.com', 'Pass2222!', 400);

  console.log('');

  // 4. KEYBOARD PATTERN TESTS
  console.log(`${colors.yellow}[4] KEYBOARD PATTERN TESTS${colors.reset}`);
  await testPassword('QWERTY pattern', 'user11', 'user11@test.com', 'Qwerty123!', 400);
  await testPassword('ASDFGH pattern', 'user12', 'user12@test.com', 'Asdfgh123!', 400);
  await testPassword('1QAZ2WSX pattern', 'user13', 'user13@test.com', '1Qaz2Wsx!', 400);

  console.log('');

  // 5. COMMON PASSWORD TESTS
  console.log(`${colors.yellow}[5] COMMON PASSWORD TESTS${colors.reset}`);
  await testPassword('Password123!', 'user14', 'user14@test.com', 'Password123!', 400);
  await testPassword('Welcome123!', 'user15', 'user15@test.com', 'Welcome123!', 400);
  await testPassword('Admin123!', 'admin1', 'admin1@test.com', 'Admin123!', 400);
  await testPassword('Letmein123!', 'user16', 'user16@test.com', 'Letmein123!', 400);
  await testPassword('Monkey123!', 'user17', 'user17@test.com', 'Monkey123!', 400);

  console.log('');

  // 6. EMAIL IN PASSWORD TESTS
  console.log(`${colors.yellow}[6] EMAIL IN PASSWORD TESTS${colors.reset}`);
  await testPassword('Email prefix in password', 'user18', 'john.doe@test.com', 'JohnDoe123!', 400);

  console.log('');

  // 7. BACKEND VALIDATION BYPASS TESTS
  console.log(`${colors.yellow}[7] BACKEND VALIDATION BYPASS TESTS${colors.reset}`);
  await testPassword('curl bypass - short password', 'user19', 'user19@test.com', 'Abc1!', 400);
  await testPassword('curl bypass - no uppercase', 'user20', 'user20@test.com', 'password123!', 400);
  await testPassword('curl bypass - no number', 'user21', 'user21@test.com', 'Password!', 400);

  console.log('');

  // 8. RATE LIMITING TESTS
  console.log(`${colors.yellow}[8] RATE LIMITING TESTS (5/15min)${colors.reset}`);
  console.log('⚠️  Running 6 rapid requests - expect 5 successes and 1 rate limit');

  for (let i = 1; i <= 6; i++) {
    const expectedStatus = i <= 5 ? 201 : 429;
    await testPassword(
      `Rate limit attempt ${i}/6`,
      `ratelimit${Date.now()}${i}`,
      `rate${Date.now()}${i}@test.com`,
      `ValidPass${i}!2026`,
      expectedStatus
    );
  }

  console.log('');

  // RESUMEN FINAL
  console.log('═'.repeat(70));
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  console.log(
    `Results: ${colors.green}${passed} PASSED${colors.reset} | ${colors.red}${failed} FAILED${colors.reset} | ${colors.blue}${total} TOTAL${colors.reset}`
  );
  console.log(`Success Rate: ${colors.blue}${successRate}%${colors.reset}`);
  console.log('═'.repeat(70));

  if (failed === 0) {
    console.log(`\n${colors.green}✓ ALL TESTS PASSED! HU03 implementation is secure.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}✗ ${failed} TESTS FAILED. Review implementation.${colors.reset}`);
    process.exit(1);
  }
}

// Ejecutar tests
runTests().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
