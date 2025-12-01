// Temporary debug script to decode JWT token
const jwt = require('jsonwebtoken');

// Paste your user token here
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTI2ZjQxMmM3ODU4MDQwMDEzMTllODciLCJlbWFpbCI6InRlc3RAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJzdWJzY3JpcHRpb25TdGF0dXMiOiJ0cmlhbCIsInNlc3Npb25UeXBlIjoidHJpYWwi";

try {
  // Decode without verification (just to see payload)
  const decoded = jwt.decode(token);
  console.log('📝 Token Payload:', JSON.stringify(decoded, null, 2));
  
  // Check if role exists
  if (decoded && decoded.role) {
    console.log('✅ Role found:', decoded.role);
  } else {
    console.log('❌ Role not found in token');
  }
  
} catch (error) {
  console.error('❌ Error decoding token:', error.message);
}
