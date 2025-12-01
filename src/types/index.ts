// ============================================
// TYPE DEFINITIONS FOR ADMIN PORTAL API
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin' | 'support';
  status: 'active' | 'disabled' | 'pending';
  lastSeen?: string;
  modelsInstalled: number;
  subscriptionStatus: 'active' | 'trial' | 'expired' | 'none';
  conversationsCount: number;
  createdAt: string;
  tags?: string[];
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  lastUsed?: string;
}

export interface InstalledModel {
  modelId: string;
  modelName: string;
  version: string;
  installedAt: string;
  size: number;
}

export interface UserDetail extends User {
  apiKeys: ApiKey[];
  licenses: License[];
  paymentHistory: Payment[];
  preferences: Record<string, any>;
  installedModels: InstalledModel[];
}

export interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  status: 'active' | 'paused' | 'cancelled' | 'trial';
  nextBillingDate?: string;
  trialEndsAt?: string;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'one-time';
  seats: number;
  features: string[];
  maxModels?: number;
  offlineModelSizeLimit?: number;
  activeSubscribers: number;
  status: 'active' | 'archived';
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  method: 'card' | 'paypal' | 'crypto' | 'other';
  date: string;
  description?: string;
}

export interface License {
  id: string;
  key: string;
  userId?: string;
  userName?: string;
  planId: string;
  planName: string;
  status: 'active' | 'expired' | 'revoked';
  issuedAt: string;
  expiresAt?: string;
  allowedModels?: string[];
  seats: number;
  activations: number;
  lastActivationIp?: string;
  lastActivationAt?: string;
}

export interface ModelVersion {
  version: string;
  releaseDate: string;
  size: number;
  changelog?: string;
  downloadUrl: string;
  installed: boolean;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  versions: ModelVersion[];
  size: number;
  installed: boolean;
  hybridCapable: boolean;
  offlineSupported: boolean;
  status: 'up-to-date' | 'update-available' | 'deprecated';
  lastUsedAt?: string;
  category: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'login' | 'logout' | 'model-download' | 'license-issue' | 'user-edit' | 'payment-refund' | 'subscription-change';
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  revenueThisMonth: number;
  installedModels: number;
  offlineModelUsagePercent: number;
  userGrowth: number;
  revenueGrowth: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  userId?: string;
  userName?: string;
  timestamp: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface JWTPayload {
  userId: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}
