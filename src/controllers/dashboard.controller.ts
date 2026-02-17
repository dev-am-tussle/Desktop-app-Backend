import { Request, Response, NextFunction } from 'express';
import { User, Payment, InstalledModel } from '../models';

// ============================================
// DASHBOARD CONTROLLERS
// ============================================

/**
 * Get Dashboard Statistics
 */
export const getDashboardStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get users from last month for growth calculation
    const lastMonthUsers = await User.countDocuments({
      createdAt: { $lte: lastMonth }
    });
    
    const userGrowth = lastMonthUsers > 0 
      ? ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100 
      : 0;

    // Get active subscriptions (users with active or trial subscription_status)
    const activeSubscriptions = await User.countDocuments({
      subscription_status: { $in: ['active', 'trial'] }
    });

    // Get revenue this month
    const revenueResult = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: thisMonthStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const revenueThisMonth = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Get last month revenue for growth
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthRevenueResult = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const lastMonthRevenue = lastMonthRevenueResult.length > 0 ? lastMonthRevenueResult[0].total : 0;
    
    const revenueGrowth = lastMonthRevenue > 0
      ? ((revenueThisMonth - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Get installed models count
    const installedModels = await InstalledModel.countDocuments();

    // Calculate offline model usage (users with modelDownloadAllowed)
    const usersWithModels = await User.countDocuments({ modelDownloadAllowed: true });
    const offlineModelUsagePercent = totalUsers > 0 
      ? (usersWithModels / totalUsers) * 100 
      : 0;

    // Get free users (no active subscription)
    const freeUsers = await User.countDocuments({
      subscription_status: { $in: ['expired', 'cancelled'] }
    });

    // Get paid users (active or trial subscription)
    const paidUsers = await User.countDocuments({
      subscription_status: { $in: ['active', 'trial'] }
    });

    res.json({
      data: {
        totalUsers,
        activeSubscriptions,
        revenueThisMonth,
        installedModels,
        offlineModelUsagePercent: Math.round(offlineModelUsagePercent),
        userGrowth: Math.round(userGrowth * 10) / 10,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        freeUsers,
        paidUsers,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Recent Activity
 */
export const getRecentActivity = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Get recent users (last 5) - using _id instead of createdAt for Cosmos DB compatibility
    const recentUsers = await User.find()
      .sort({ _id: -1 })
      .limit(5)
      .select('name email createdAt');

    // Get recent plan upgrades (users with active/trial status, last 5)
    const recentPlanUpgrades = await User.find({
      subscription_status: { $in: ['active', 'trial'] }
    })
      .sort({ _id: -1 })
      .limit(5)
      .populate('plan_id', 'display_name')
      .select('name email plan_id subscription_status createdAt');

    // Get recent payments (last 5)
    const recentPayments = await Payment.find()
      .sort({ _id: -1 })
      .limit(5)
      .populate('userId', 'name email');

    // Combine and format activity
    const activity = [];

    // Add user signups
    for (const user of recentUsers) {
      activity.push({
        id: `user-${user._id}`,
        type: 'signup',
        message: `New user registered: ${user.name}`,
        userName: user.name,
        userId: user._id.toString(),
        timestamp: user.createdAt.toISOString(),
      });
    }

    // Add plan upgrades
    for (const user of recentPlanUpgrades) {
      const planName = (user.plan_id as any)?.display_name || 'Unknown Plan';
      const statusLabel = user.subscription_status === 'trial' ? 'started trial for' : 'subscribed to';
      activity.push({
        id: `plan-${user._id}`,
        type: 'subscription',
        message: `${user.name} ${statusLabel} ${planName}`,
        userName: user.name,
        userId: user._id.toString(),
        timestamp: user.createdAt.toISOString(),
      });
    }

    // Add payments
    for (const payment of recentPayments) {
      const userName = (payment.userId as any)?.name || 'Unknown User';
      activity.push({
        id: `payment-${payment._id}`,
        type: 'payment',
        message: `${userName} made a payment of $${payment.amount}`,
        userName,
        userId: (payment.userId as any)?._id?.toString(),
        timestamp: payment.createdAt.toISOString(),
      });
    }

    // Sort by timestamp descending and limit to 20
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limitedActivity = activity.slice(0, 20);

    res.json({
      data: limitedActivity
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Signups Chart Data
 */
export const getSignupsChart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const signups = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format data for chart
    const chartData = signups.map(item => ({
      date: item._id,
      value: item.count,
      label: `${item.count} signups`
    }));

    res.json({
      data: chartData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Revenue Chart Data
 */
export const getRevenueChart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const revenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format data for chart
    const chartData = revenue.map(item => ({
      date: item._id,
      value: item.total,
      label: `$${item.total.toFixed(2)}`
    }));

    res.json({
      data: chartData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get User Activity Chart Data
 * Shows active vs inactive users based on lastSeen field
 */
export const getUserActivityChart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily active/inactive user counts
    const chartData = [];
    const totalUsers = await User.countDocuments();

    for (let i = 0; i < days; i++) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() - (days - i - 1));
      currentDate.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      // Count users who logged in on this specific day
      const activeUsers = await User.countDocuments({
        lastSeen: {
          $gte: currentDate,
          $lt: nextDate
        }
      });

      const inactiveUsers = totalUsers - activeUsers;

      chartData.push({
        date: currentDate.toISOString().split('T')[0],
        activeUsers,
        inactiveUsers,
        activeLabel: `${activeUsers} active`,
        inactiveLabel: `${inactiveUsers} inactive`
      });
    }

    res.json({
      data: chartData
    });
  } catch (error) {
    next(error);
  }
};
