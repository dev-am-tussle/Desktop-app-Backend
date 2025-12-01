/**
 * Create Admin User Script (JavaScript Version)
 * 
 * This script creates an admin user in MongoDB
 * Run: node scripts/createAdmin.js
 */

const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify readline question
const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

/**
 * Admin Schema (inline for standalone script)
 */
const AdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: ['admin', 'superadmin', 'support'],
      default: 'admin',
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    avatar: String,
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
  },
  { timestamps: true }
);

// Hash password before saving
AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    this.password = await bcrypt.hash(this.password, rounds);
    next();
  } catch (error) {
    next(error);
  }
});

const Admin = mongoose.model('Admin', AdminSchema);

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    // Check multiple possible environment variable names
    const mongoURI = process.env.MONGODB_URI || 
                     process.env.AZURE_COSMOS_CONNECTIONSTRING || 
                     'mongodb://localhost:27017/sovereign-ai';
    
    if (!mongoURI || mongoURI === 'mongodb://localhost:27017/sovereign-ai') {
      console.log('⚠️  Using local MongoDB connection');
      console.log('💡 Add MONGODB_URI or AZURE_COSMOS_CONNECTIONSTRING to .env for production\n');
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
const isValidPassword = (password) => {
  return password.length >= 8;
};

/**
 * Create Admin User
 */
const createAdmin = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 CREATE ADMIN USER');
  console.log('='.repeat(60) + '\n');

  try {
    // Get admin details
    const name = await question('Enter admin name: ');
    if (!name || name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters');
    }

    const email = await question('Enter admin email: ');
    if (!isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Check if admin with email already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      throw new Error(`Admin with email ${email} already exists`);
    }

    const password = await question('Enter admin password (min 8 characters): ');
    if (!isValidPassword(password)) {
      throw new Error('Password must be at least 8 characters');
    }

    console.log('\nSelect admin role:');
    console.log('1. admin - Full admin access');
    console.log('2. support - Support team access (read-only)');
    const roleChoice = await question('Enter role (1-2): ');

    let role;
    switch (roleChoice) {
      case '1':
        role = 'admin';
        break;
      case '2':
        role = 'support';
        break;
      default:
        throw new Error('Invalid role selection');
    }

    // Create admin
    console.log('\n⏳ Creating admin...');
    const admin = await Admin.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      status: 'active',
      loginAttempts: 0,
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ ADMIN CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📧 Email: ${admin.email}`);
    console.log(`👤 Name: ${admin.name}`);
    console.log(`🔑 Role: ${admin.role}`);
    console.log(`✅ Status: ${admin.status}`);
    console.log(`🆔 ID: ${admin._id}`);
    console.log('='.repeat(60) + '\n');

    console.log('🎉 You can now login to the admin portal with these credentials!');
    console.log(`🌐 Admin Portal: http://localhost:5173/admin/login\n`);

  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    throw error;
  }
};

/**
 * Main function
 */
const main = async () => {
  try {
    await connectDB();
    await createAdmin();
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();
