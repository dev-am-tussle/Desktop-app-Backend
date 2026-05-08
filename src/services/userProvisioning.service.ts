import jwt from 'jsonwebtoken';
import User from '../models/User.model';
import SubscriptionPlan from '../models/SubscriptionPlan.model';
import { getSubscriptionDetails } from '../utils/userHelpers';

export interface IProvisionedUserInput {
  name: string;
  email: string;
  password: string;
  authProvider?: {
    provider_name: 'google' | 'microsoft' | 'email';
    verified: boolean;
  };
  consent?: {
    termsAccepted: boolean;
    termsAcceptedAt?: Date;
    termsVersion?: string;
  };
}

export interface IRegistrationResponse {
  data: {
    [key: string]: any;
    authentication: {
      sessionToken: string;
      refreshToken: string;
      expiresIn: string;
      message: string;
    };
  };
}

function buildConsent(consent?: IProvisionedUserInput['consent']) {
  const now = new Date();

  return {
    termsAccepted: consent?.termsAccepted ?? true,
    termsAcceptedAt: consent?.termsAcceptedAt || now,
    termsVersion: consent?.termsVersion || 'v1',
  };
}

async function getFreeTrialPlan() {
  const freePlan = await SubscriptionPlan.findOne({
    $or: [
      { slug: 'free' },
      { name: 'free' },
    ],
    status: 'active',
  });

  if (!freePlan) {
    throw new Error('Free plan not configured');
  }

  return freePlan;
}

export async function provisionOAuthTrialUser(input: IProvisionedUserInput) {
  const email = input.email.toLowerCase();
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return {
      user: existingUser,
      subscriptionDetails: await getSubscriptionDetails(existingUser),
      isNewUser: false,
    };
  }

  const freePlan = await getFreeTrialPlan();
  const user = await User.create({
    name: input.name,
    email,
    password: input.password,
    role: 'user',
    status: 'active',
    plan_id: freePlan._id,
    subscription_status: 'trial',
    onboardingPhase: 'account_created',
    phaseCompletedAt: {
      accountCreated: new Date(),
    },
    tags: ['oauth-user'],
    consent: buildConsent(input.consent),
    authProvider: {
      provider_name: input.authProvider?.provider_name || 'email',
      verified: input.authProvider?.verified ?? true,
    },
  });

  return {
    user,
    subscriptionDetails: await getSubscriptionDetails(user),
    isNewUser: true,
  };
}

export function createOAuthSessionToken(user: { _id: any; email: string; name: string }): string {
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';

  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: 'user',
      type: 'user',
      name: user.name,
    },
    jwtSecret,
    { expiresIn: '30d' }
  );
}

export function createOAuthRefreshToken(user: { _id: any }): string {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

  return jwt.sign(
    {
      userId: user._id.toString(),
      type: 'user-refresh',
    },
    refreshSecret,
    { expiresIn: '90d' }
  );
}

export function createOAuthRegistrationResponse(user: any, subscriptionDetails: any): IRegistrationResponse {
  const sessionToken = createOAuthSessionToken(user);
  const refreshToken = createOAuthRefreshToken(user);

  return {
    data: {
      ...subscriptionDetails,
      authentication: {
        sessionToken,
        refreshToken,
        expiresIn: '30 days',
        message: 'Registration successful!',
      },
    },
  };
}