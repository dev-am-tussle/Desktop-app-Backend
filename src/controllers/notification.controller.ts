import { Request, Response } from 'express';
import { Notification, NotificationRecipient, User, NotificationVersion } from '../models';

/**
 * ADMIN: Create a new notification (Default: Draft)
 */
export const createNotification = async (req: Request, res: Response) => {
  try {
    const { targetType, targetFilters, targetUserIds } = req.body;

    // Validation
    if (targetType === 'specific' && (!targetUserIds || targetUserIds.length === 0)) {
      return res.status(400).json({ success: false, message: 'targetUserIds required for specific targeting' });
    }
    if (targetType === 'segment' && !targetFilters) {
      return res.status(400).json({ success: false, message: 'targetFilters required for segment targeting' });
    }

    // Extract only allowed fields from req.body
    const allowedFields = [
      'title', 'message', 'type', 'category', 'priority', 
      'targetType', 'targetFilters', 'targetUserIds', 'action',
      'isDismissible', 'scheduledAt', 'expiresAt'
    ];

    const notificationData: any = {};
    allowedFields.forEach(field => {
      if (field in req.body) {
        notificationData[field] = req.body[field];
      }
    });

    const notification = await Notification.create({
      ...notificationData,
      status: req.body.status === 'active' ? 'active' : 'draft', // Only allow draft or active
      version: 1, // 🔴 ALWAYS 1 for new notifications, NEVER from user input
      createdBy: req.user?.userId || req.admin?.adminId
    });
    
    return res.status(201).json({ success: true, data: notification });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * ADMIN: Update and Publish (Increment Global Version)
 */
export const updateNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await Notification.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Notification not found' });

    const updates = { ...req.body };
    
    // Increment GLOBAL version if moving to active status
    if (updates.status === 'active' && existing.status !== 'active') {
      // Get or create global version counter
      let versionDoc = await NotificationVersion.findOne();
      if (!versionDoc) {
        versionDoc = await NotificationVersion.create({ currentVersion: 0 });
      }
      
      // Increment global counter
      versionDoc.currentVersion += 1;
      versionDoc.lastIncrementedAt = new Date();
      await versionDoc.save();

      // Set notification version to new global version
      updates.version = versionDoc.currentVersion;
      updates.publishedAt = new Date();
    }

    const notification = await Notification.findByIdAndUpdate(id, updates, { new: true });
    return res.json({ success: true, data: notification });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * APP: Version-Based Delta Sync (POST Payload)
 * POST /notifications/sync
 */
export const syncNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { currentVersion, platform, appVersion } = req.body;
    const clientVersion = parseInt(currentVersion) || 0;

    // Get user with timeout protection
    let user: any = null;
    try {
      const userPromise = User.findById(userId);
      user = await Promise.race([
        userPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('User lookup timeout')), 5000)
        )
      ]);
    } catch (timeoutErr: any) {
      // If user lookup times out, proceed with fallback (no plan filter)
      console.warn(`User lookup timeout for userId: ${userId}`);
      user = null;
    }

    // If user is null, we'll just skip plan-based filtering
    const userPlanId = user?.plan_id || null;

    const now = new Date();

    // 1. Delta Sync Query
    const query: any = {
      status: 'active',
      isDeleted: false,
      version: { $gt: clientVersion },
      $and: [
        { $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: { $lte: now } }] },
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] }
      ]
    };

    // 2. Audience Filtering
    const planFilter = userPlanId 
      ? [{ 'targetFilters.plan': userPlanId }] 
      : [];

    query.$or = [
      { targetType: 'all' },
      {
        targetType: 'segment',
        $and: [
          { $or: [{ 'targetFilters.plan': { $exists: false } }, ...planFilter] },
          { $or: [{ 'targetFilters.platform': { $exists: false } }, { 'targetFilters.platform': platform }] },
          { $or: [{ 'targetFilters.appVersion': { $exists: false } }, { 'targetFilters.appVersion': appVersion }] }
        ]
      },
      {
        targetType: 'specific',
        targetUserIds: userId
      }
    ];

    const notifications = await Notification.find(query).sort({ version: 1 }).limit(50);

    // Get current global version
    let globalVersion = clientVersion;
    const versionDoc = await NotificationVersion.findOne();
    if (versionDoc) {
      globalVersion = versionDoc.currentVersion;
    }

    // If no new notifications, return success with empty data
    if (notifications.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Everything up to date', 
        data: [], 
        latestVersion: globalVersion 
      });
    }

    // 3. Batch track delivery status
    const deliveryEntries = notifications.map(n => ({
      userId,
      notificationId: n._id,
      deliveredAt: now
    }));

    await NotificationRecipient.insertMany(deliveryEntries, { ordered: false }).catch(() => {});

    return res.json({ 
      success: true, 
      data: notifications, 
      latestVersion: globalVersion 
    });
  } catch (error: any) {
    console.error('Sync Error:', error.message);
    
    // Return more specific error messages instead of 500
    if (error.message.includes('timeout')) {
      return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please retry.' });
    }
    
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Interaction Tracking
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { notificationId } = req.params;

    await NotificationRecipient.findOneAndUpdate(
      { userId, notificationId },
      { isRead: true, readAt: new Date() },
      { upsert: true }
    );

    return res.json({ success: true, message: 'Marked as read' });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const dismissNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { notificationId } = req.params;

    await NotificationRecipient.findOneAndUpdate(
      { userId, notificationId },
      { isDismissed: true, dismissedAt: new Date() },
      { upsert: true }
    );

    return res.json({ success: true, message: 'Dismissed' });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isDeleted: true });
    return res.json({ success: true, message: 'Deleted' });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * ADMIN: List all notifications with filters, search, and delivery stats
 * GET /notifications?status=active&page=1&limit=20&sort=-createdAt&search=welcome
 */
export const listNotifications = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { status, targetType, category, search, sort } = req.query;
    const skip = (page - 1) * limit;

    // Build query filter
    const query: any = { isDeleted: false };

    if (status) query.status = status;
    if (targetType) query.targetType = targetType;
    if (category) query.category = category;

    // Search in title and message
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    const total = await Notification.countDocuments(query);

    // Build sort object
    let sortObj: any = { createdAt: -1 };
    if (sort && typeof sort === 'string') {
      const isDesc = sort.startsWith('-');
      const field = isDesc ? sort.substring(1) : sort;
      sortObj = { [field]: isDesc ? -1 : 1 };
    }

    // Fetch paginated notifications
    const notifications = await Notification.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get delivery stats for each notification
    const notificationsWithStats = await Promise.all(
      notifications.map(async (notif: any) => {
        const stats = await NotificationRecipient.aggregate([
          { $match: { notificationId: notif._id } },
          {
            $group: {
              _id: null,
              deliveredCount: { $sum: 1 },
              readCount: { $sum: { $cond: ['$isRead', 1, 0] } },
              dismissedCount: { $sum: { $cond: ['$isDismissed', 1, 0] } }
            }
          }
        ]);

        return {
          ...notif,
          deliveryStats: stats.length > 0 ? stats[0] : {
            deliveredCount: 0,
            readCount: 0,
            dismissedCount: 0
          }
        };
      })
    );

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: notificationsWithStats,
      pagination: {
        total,
        page,
        limit,
        pages: totalPages
      }
    });
  } catch (error: any) {
    console.error('List Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
