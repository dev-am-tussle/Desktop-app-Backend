import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.AZURE_COSMOS_CONNECTIONSTRING || 'mongodb://localhost:27017/admin_portal';

const connectDatabase = async (): Promise<void> => {
  try {
    if (!process.env.AZURE_COSMOS_CONNECTIONSTRING) {
      console.warn('⚠️ WARNING: AZURE_COSMOS_CONNECTIONSTRING not set. Running without database.');
      console.warn('⚠️ Add connection string in Azure App Service Configuration.');
      return;
    }

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB connected successfully');
    const dbName = mongoose.connection.db?.databaseName ?? 'unknown';
    console.log(`📊 Database: ${dbName}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.warn('⚠️ Continuing without database connection...');
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

export default connectDatabase;
