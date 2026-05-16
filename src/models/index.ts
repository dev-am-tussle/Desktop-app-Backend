// ============================================
// CENTRALIZED MODELS EXPORT
// ============================================
// All models are exported from this single file
// for easy import and management across the application

import User from './User.model';
import Admin from './Admin.model';
// import Subscription from './Subscription.model'; // DEPRECATED - Use User.plan_id instead
import SubscriptionPlan from './SubscriptionPlan.model';
import Payment from './Payment.model';
import PaymentSession from './PaymentSession.model';
import License from './License.model';
import Model from './Model.model';
import AuditLog from './AuditLog.model';
import InstalledModel from './InstalledModel.model';
import ApiKey from './ApiKey.model';
import Conversation from './Conversation.model';

// NEW: Entitlement System Models
import EntitlementDefinition from './EntitlementDefinition.model';
import PlanEntitlement from './PlanEntitlement.model';
import UserEntitlementOverride from './UserEntitlementOverride.model';
import EntitlementCache from './EntitlementCache.model';
import UserTelemetry from './UserTelemetry.model';
import { Coupon } from './Coupon.model';
import { CouponRedemption } from './CouponRedemption.model';

// NEW: FX Rates Management
import FXRate from './FXRate.model';
import Support from './Support.model';
import RecommendedModel from './RecommendedModel.model';
import Notification from './Notification.model';
import NotificationRecipient from './NotificationRecipient.model';
import NotificationVersion from './NotificationVersion.model';
import McpConnector from './McpConnector.model';

import ConnectorAuthSession from './ConnectorAuthSession.model';
import McpCredentials from './McpCredentials.model';
import OAuthAccount from './OAuthAccount.model';
import EmailVerification from './EmailVerification.model';
import Referral from './Referral.model';

// Export all models
export {
  User,
  Admin,
  SubscriptionPlan,
  Payment,
  PaymentSession,
  License,
  Model,
  AuditLog,
  InstalledModel,
  ApiKey,
  Conversation,
  // Entitlement System
  EntitlementDefinition,
  PlanEntitlement,
  UserEntitlementOverride,
  EntitlementCache,
  UserTelemetry,
  Coupon,
  CouponRedemption,
  // FX Rates Management
  FXRate,
  // Support
  Support,
  // Recommended Models
  RecommendedModel,
  // Notification
  Notification,
  NotificationRecipient,
  NotificationVersion,
  McpConnector,
  ConnectorAuthSession,
  // MCP Credentials
  McpCredentials,
  // OAuth of Accounts
  OAuthAccount,
  // Email Verification (OTP)
  EmailVerification,
  Referral,
};

// Export types
export type { IUser } from './User.model';
export type { IAdmin } from './Admin.model';
export type { ISubscriptionPlan } from './SubscriptionPlan.model';
export type { IPayment } from './Payment.model';
export type { IConnectorAuthSession } from './ConnectorAuthSession.model';
export type { IPaymentSession } from './PaymentSession.model';
export type { ILicense } from './License.model';
export type { IModel, IModelVersion } from './Model.model';
export type { IAuditLog } from './AuditLog.model';
export type { IInstalledModel } from './InstalledModel.model';
export type { IApiKey } from './ApiKey.model';
export type { IConversation } from './Conversation.model';
export type { ISupport } from './Support.model';
export type { IRecommendedModel } from './RecommendedModel.model';
export type { INotification } from './Notification.model';
export type { INotificationRecipient } from './NotificationRecipient.model';
export type { IEmailVerification } from './EmailVerification.model';
export type { IReferral } from './Referral.model';

// Entitlement System Types
export type { IEntitlementDefinition } from './EntitlementDefinition.model';
export type { IPlanEntitlement } from './PlanEntitlement.model';
export type { IUserEntitlementOverride } from './UserEntitlementOverride.model';
export type { IEntitlementCache } from './EntitlementCache.model';
export type { ICoupon } from './Coupon.model';
export type { ICouponRedemption } from './CouponRedemption.model';

// FX Rates Management Types
export type { IFXRate } from './FXRate.model';

// MCP Credentials Types
export type { IMcpCredentials } from './McpCredentials.model';

// OAuth Account Types
export type { IOAuthAccount } from './OAuthAccount.model';

// Default export - all models as object
export default {
  User,
  Admin,
  SubscriptionPlan,
  Payment,
  PaymentSession,
  License,
  Model,
  AuditLog,
  InstalledModel,
  ApiKey,
  Conversation,
  Coupon,
  CouponRedemption,
  ConnectorAuthSession,
  McpCredentials,
  EmailVerification,
};
