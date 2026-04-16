import { Request, Response, NextFunction } from 'express';
import { McpConnector } from '../models';
import { AppError } from '../middleware/errorHandler';

/**
 * GET /v1/marketplace/connectors
 * Public endpoint for users to browse available connectors
 */
export const getMarketplaceConnectors = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { category, isPopular, search } = req.query;

        const filter: any = { isArchived: false };
        if (category) filter.category = category;
        if (isPopular === 'true') filter.isPopular = true;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const connectors = await McpConnector.find(filter)
            .sort({ isPopular: -1, name: 1 });

        res.json({
            status: 'success',
            results: connectors.length,
            data: connectors
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /v1/marketplace/connectors/:id
 */
export const getConnectorById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const connector = await McpConnector.findOne({ _id: id, isArchived: false });

        if (!connector) {
            throw new AppError('Connector not found or archived', 404, 'CONNECTOR_NOT_FOUND');
        }

        res.json({
            status: 'success',
            data: connector
        });
    } catch (error) {
        next(error);
    }
};

// --- ADMIN CONTROLLERS ---

/**
 * POST /admin/connectors
 */
export const createConnector = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connector = await McpConnector.create(req.body);

        res.status(201).json({
            status: 'success',
            data: connector
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /admin/connectors/:id
 */
export const updateConnector = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const connector = await McpConnector.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        if (!connector) {
            throw new AppError('Connector not found', 404, 'CONNECTOR_NOT_FOUND');
        }

        res.json({
            status: 'success',
            data: connector
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /admin/connectors/:id
 * Soft delete by archiving
 */
export const deleteConnector = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const connector = await McpConnector.findByIdAndUpdate(id, { isArchived: true }, { new: true });

        if (!connector) {
            throw new AppError('Connector not found', 404, 'CONNECTOR_NOT_FOUND');
        }

        res.json({
            status: 'success',
            message: 'Connector archived successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /admin/connectors
 * Admin view (includes archived)
 */
export const getAllConnectorsAdmin = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const connectors = await McpConnector.find().sort({ createdAt: -1 });

        res.json({
            status: 'success',
            results: connectors.length,
            data: connectors
        });
    } catch (error) {
        next(error);
    }
};
