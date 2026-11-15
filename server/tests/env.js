// Test environment: a separate database, fast bcrypt, no IP rate limiting.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'rbac_elearning_test';
process.env.BCRYPT_COST = '4';
