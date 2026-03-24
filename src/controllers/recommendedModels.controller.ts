import { Request, Response, NextFunction } from 'express';
import { RecommendedModel } from '../models';
import { AppError } from '../middleware/errorHandler';

/**
 * @desc    Get all recommended models (Public/User)
 * @route   GET /api/recommended-models
 * @access  Public
 */
export const getRecommendedModels = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await RecommendedModel.find({ isActive: true })
      .sort({ order: 1 })
      .lean();

    res.status(200).json({
      status: 'success',
      results: models.length,
      data: models,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all recommended models (Admin/User list view - includes inactive)
 * @route   GET /api/recommended-models/all
 * @access  Private (Admin or Authenticated User)
 */
export const getAllRecommendedModels = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await RecommendedModel.find()
      .sort({ order: 1 })
      .lean();

    res.status(200).json({
      status: 'success',
      results: models.length,
      data: models,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new recommended model (Admin only)
 * @route   POST /api/recommended-models
 * @access  Private/Admin
 */
export const createRecommendedModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      name, 
      description, 
      category, 
      size, 
      ram,
      tag,
      provider,
      downloadUrl,
      isPopular, 
      order, 
      isActive 
    } = req.body;

    if (!name) {
      return next(new AppError('Please provide a name for the model', 400, 'MISSING_FIELDS'));
    }

    const model = await RecommendedModel.create({
      name,
      ollamaName: name, // Both will be same as per payload
      description,
      category,
      size,
      ram,
      tag,
      provider: provider || 'ollama',
      downloadUrl,
      isPopular,
      order,
      isActive,
    });

    res.status(201).json({
      status: 'success',
      data: model,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk create recommended models (Admin only)
 * @route   POST /api/recommended-models/bulk
 * @access  Private/Admin
 */
export const bulkCreateRecommendedModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const modelsData = req.body;

    if (!Array.isArray(modelsData)) {
      return next(new AppError('Payload must be an array of models', 400, 'INVALID_PAYLOAD'));
    }

    // Map the incoming data to include ollamaName (same as name)
    const formattedModels = modelsData.map((model: any) => ({
      ...model,
      ollamaName: model.name, // Ensure ollamaName is set as per requirement
    }));

    // Use insertMany for efficient bulk insertion
    // ordered: false allows continuing even if some documents fail (e.g. duplicate ollamaName)
    const models = await RecommendedModel.insertMany(formattedModels, { ordered: false });

    res.status(201).json({
      status: 'success',
      results: models.length,
      data: models,
    });
  } catch (error: any) {
    // If some succeeded but others failed (like duplicates), we might still want to return success
    if (error.name === 'MongoBulkWriteError') {
      return res.status(207).json({
        status: 'partial_success',
        results: error.insertedDocs?.length || 0,
        message: 'Some models were inserted, but others failed (likely duplicates)',
        errors: error.writeErrors?.length || 0,
        data: error.insertedDocs
      });
    }
    next(error);
  }
};

/**
 * @desc    Update a recommended model (Admin only)
 * @route   PATCH /api/recommended-models/:id
 * @access  Private/Admin
 */
export const updateRecommendedModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const model = await RecommendedModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!model) {
      return next(new AppError('No recommended model found with that ID', 404, 'MODEL_NOT_FOUND'));
    }

    res.status(200).json({
      status: 'success',
      data: model,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a recommended model (Admin only)
 * @route   DELETE /api/recommended-models/:id
 * @access  Private/Admin
 */
export const deleteRecommendedModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const model = await RecommendedModel.findByIdAndDelete(req.params.id);

    if (!model) {
      return next(new AppError('No recommended model found with that ID', 404, 'MODEL_NOT_FOUND'));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
