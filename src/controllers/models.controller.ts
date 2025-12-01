import { Request, Response, NextFunction } from 'express';
import { Model } from '../models';
import { AppError } from '../middleware/errorHandler';

/**
 * Get All Models
 */
export const getModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, perPage = 20, category, status } = req.query;

    const filter: any = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const [models, total] = await Promise.all([
      Model.find(filter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit),
      Model.countDocuments(filter),
    ]);

    res.json({
      data: models,
      meta: {
        page: Number(page),
        perPage: Number(perPage),
        total,
        totalPages: Math.ceil(total / Number(perPage)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Model by ID
 */
export const getModelById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const model = await Model.findById(id);
    if (!model) {
      throw new AppError('Model not found', 404, 'MODEL_NOT_FOUND');
    }

    res.json({ data: model });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload/Create Model
 */
export const uploadModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, version, category, size, description, requirements } = req.body;

    const model = await Model.create({
      name,
      version,
      category,
      size,
      description,
      requirements,
      status: 'active',
    });

    res.status(201).json({
      data: model,
      message: 'Model uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Model
 */
export const updateModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const model = await Model.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!model) {
      throw new AppError('Model not found', 404, 'MODEL_NOT_FOUND');
    }

    res.json({
      data: model,
      message: 'Model updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Model
 */
export const deleteModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const model = await Model.findByIdAndDelete(id);
    if (!model) {
      throw new AppError('Model not found', 404, 'MODEL_NOT_FOUND');
    }

    res.json({
      message: 'Model deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download Model
 */
export const downloadModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelId } = req.params;
    const { version } = req.body;

    const model = await Model.findById(modelId);
    if (!model) {
      throw new AppError('Model not found', 404, 'MODEL_NOT_FOUND');
    }

    res.json({
      data: {
        modelId,
        version,
        downloadUrl: `/downloads/models/${modelId}/${version}`,
      },
      message: 'Model download initiated',
    });
  } catch (error) {
    next(error);
  }
};
