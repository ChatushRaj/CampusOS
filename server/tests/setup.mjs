// Test environment. These values never leave the test process and are not secrets.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://campusos:test@127.0.0.1:3306/campusos_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-used-in-production';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-used-in-production';
process.env.STAFF_INVITE_CODE = 'test-invite-code';
process.env.PUBLIC_URL = 'http://localhost:4000';
