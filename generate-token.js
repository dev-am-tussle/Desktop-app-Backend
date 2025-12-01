// Quick JWT Token Generator for Testing
// Run: node generate-token.js

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// IMPORTANT: Replace this with actual User ID from your MongoDB after creating a user
// Or use the one generated below
const userId = new mongoose.Types.ObjectId();

console.log('🔑 JWT Token Generator\n');
console.log('=' .repeat(60));

// Generate token with test user credentials
const token = jwt.sign(
  {
    userId: userId.toString(),
    email: 'admin@test.com',
    role: 'superadmin'
  },
  // Use your JWT_SECRET from .env
  'your_super_secret_jwt_key_change_this_in_production_min_32_chars',
  { expiresIn: '24h' }
);

console.log('\n✅ Generated JWT Token (Valid for 24 hours):\n');
console.log(token);
console.log('\n📋 User ID (Save this for MongoDB):\n');
console.log(userId.toString());
console.log('\n' + '='.repeat(60));
console.log('\n📝 Instructions:');
console.log('1. Copy the JWT Token above');
console.log('2. In Postman, set environment variable "token" to this value');
console.log('3. Use the User ID when inserting test user in MongoDB');
console.log('\nMongoDB Insert Command:');
console.log(`
db.users.insertOne({
  _id: ObjectId("${userId.toString()}"),
  name: "Test Admin",
  email: "admin@test.com",
  password: "$2b$10$X9Y9h1H1H1H1H1H1H1H1H.O8jHZQJ0NqPZn3wRhGxHXhXhXhXhXh",
  role: "superadmin",
  status: "active",
  subscriptionStatus: "none",
  tags: [],
  preferences: {},
  createdAt: new Date(),
  updatedAt: new Date()
})
`);
console.log('Password for this user: Test@123456\n');
