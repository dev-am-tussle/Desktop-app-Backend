// ============================================
// CENTRALIZED MODELS EXPORT
// ============================================
// All models are exported from this single file
// for easy import and management across the application

import User from './User.model';
import Admin from './Admin.model';
import Subscription from './Subscription.model';
import SubscriptionPlan from './SubscriptionPlan.model';
import Payment from './Payment.model';
import PaymentSession from './PaymentSession.model';
import License from './License.model';
import Model from './Model.model';
import AuditLog from './AuditLog.model';
import InstalledModel from './InstalledModel.model';
import ApiKey from './ApiKey.model';
import Conversation from './Conversation.model';

// Export all models
export {
  User,
  Admin,
  Subscription,
  SubscriptionPlan,
  Payment,
  PaymentSession,
  License,
  Model,
  AuditLog,
  InstalledModel,
  ApiKey,
  Conversation,
};

// Export types
export type { IUser } from './User.model';
export type { IAdmin } from './Admin.model';
export type { ISubscription } from './Subscription.model';
export type { ISubscriptionPlan } from './SubscriptionPlan.model';
export type { IPayment } from './Payment.model';
export type { IPaymentSession } from './PaymentSession.model';
export type { ILicense } from './License.model';
export type { IModel, IModelVersion } from './Model.model';
export type { IAuditLog } from './AuditLog.model';
export type { IInstalledModel } from './InstalledModel.model';
export type { IApiKey } from './ApiKey.model';
export type { IConversation } from './Conversation.model';

// Default export - all models as object
export default {
  User,
  Admin,
  Subscription,
  SubscriptionPlan,
  Payment,
  PaymentSession,
  License,
  Model,
  AuditLog,
  InstalledModel,
  ApiKey,
  Conversation,
};
