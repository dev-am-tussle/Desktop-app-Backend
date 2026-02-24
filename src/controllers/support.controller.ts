import { Request, Response, NextFunction } from 'express';
import { Support } from '../models';
import { AppError } from '../middleware/errorHandler';

/**
 * @desc    Create a support ticket
 * @route   POST /api/support/contact
 * @access  Public
 */
export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, subject, message, consentChecked, metadata } = req.body;
        const userId = req.user?.userId;

        // Payload uses 'email', but we store it as 'user_email' in the DB
        if (!name || !email || !message) {
            return next(new AppError('Please provide name, email, and message', 400, 'MISSING_FIELDS'));
        }

        const ticketSubject = subject || `Req for support BY : ${name}`;

        const ticket = await Support.create({
            user_id: userId,
            name,
            user_email: email,
            subject: ticketSubject,
            message,
            consentChecked,
            metadata,
            isRead: false
        });

        res.status(201).json({
            status: 'success',
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all support tickets (Admin only)
 * @route   GET /api/support/tickets
 * @access  Private/Admin
 */
export const getAllTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;

        const filter: any = {};
        if (isRead !== undefined) {
            filter.isRead = isRead;
        }

        const [tickets, total] = await Promise.all([
            Support.find(filter)
                .populate('user_id', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Support.countDocuments(filter),
        ]);

        res.status(200).json({
            status: 'success',
            results: tickets.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: tickets
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mark ticket as read
 * @route   PATCH /api/support/tickets/:id/read
 * @access  Private/Admin
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ticket = await Support.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true, runValidators: true }
        );

        if (!ticket) {
            return next(new AppError('No ticket found with that ID', 404, 'TICKET_NOT_FOUND'));
        }

        res.status(200).json({
            status: 'success',
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mark ticket as unread
 * @route   PATCH /api/support/tickets/:id/unread
 * @access  Private/Admin
 */
export const markAsUnread = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ticket = await Support.findByIdAndUpdate(
            req.params.id,
            { isRead: false },
            { new: true, runValidators: true }
        );

        if (!ticket) {
            return next(new AppError('No ticket found with that ID', 404, 'TICKET_NOT_FOUND'));
        }

        res.status(200).json({
            status: 'success',
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete a support ticket
 * @route   DELETE /api/support/tickets/:id
 * @access  Private/Admin
 */
export const deleteTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const ticket = await Support.findByIdAndDelete(req.params.id);

        if (!ticket) {
            return next(new AppError('No ticket found with that ID', 404, 'TICKET_NOT_FOUND'));
        }

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (error) {
        next(error);
    }
};
