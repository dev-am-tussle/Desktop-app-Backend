import mongoose, { Schema, Document, Model, CallbackWithoutResultAndOptionalError, HydratedDocument } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  role: 'user';
  status: 'active' | 'disabled' | 'pending';
  lastSeen?: Date;
  tags?: string[];
  preferences?: Record<string, any>;
  
  // Stripe Integration Fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Desktop Application Onboarding Phase Tracking
  onboardingPhase: 'account_created' | 'plan_selection' | 'payment_processing' | 'model_setup' | 'completed';
  phaseCompletedAt?: {
    accountCreated?: Date;
    planSelection?: Date;
    paymentProcessing?: Date;
    modelSetup?: Date;
    completed?: Date;
  };
  lastActivePhase?: string;
  
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [1, 'Name must be at least 1 character'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [255, 'Email cannot exceed 255 characters'],
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password by default in queries
    },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'support'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'disabled', 'pending'],
      default: 'active',
    }, 
    lastSeen: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    preferences: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Desktop Application Onboarding Phase Tracking
    onboardingPhase: {
      type: String,
      enum: ['account_created', 'plan_selection', 'payment_processing', 'model_setup', 'completed'],
      default: 'account_created',
    },
    phaseCompletedAt: {
      type: {
        accountCreated: { type: Date, default: null },
        planSelection: { type: Date, default: null },
        paymentProcessing: { type: Date, default: null },
        modelSetup: { type: Date, default: null },
        completed: { type: Date, default: null },
      },
      default: {},
    },
    lastActivePhase: {
      type: String,
      default: null,
    },
    // Stripe Integration Fields
    stripeCustomerId: {
      type: String,
      default: null,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc: Document, ret: any) {
        ret.id = ret._id;
        delete (ret as any)._id;
        delete (ret as any).__v;
        delete (ret as any).password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Index for performance
// Note: email index is automatic due to unique: true
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ onboardingPhase: 1 });
UserSchema.index({ lastActivePhase: 1 });

// Hash password before saving
UserSchema.pre('save', async function (this: HydratedDocument<IUser>, next: CallbackWithoutResultAndOptionalError) {
  if (!this.isModified('password')) return next();

  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    this.password = await bcrypt.hash(this.password, rounds);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for active subscription
UserSchema.virtual('activeSubscription', {
  ref: 'Subscription',
  localField: '_id',
  foreignField: 'userId',
  justOne: true,
  match: { status: { $in: ['active', 'trial'] } },
});

// Virtual for active licenses
UserSchema.virtual('activeLicenses', {
  ref: 'License',
  localField: '_id',
  foreignField: 'userId',
  match: { status: 'active' },
});

// Virtual for payments
UserSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'userId',
});

// Virtual for installed models count
UserSchema.virtual('installedModelsCount', {
  ref: 'InstalledModel',
  localField: '_id',
  foreignField: 'userId',
  count: true,
});

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;
