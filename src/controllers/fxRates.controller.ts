import { Request, Response, NextFunction } from 'express';
import FXRate from '../models/FXRate.model';
import { AppError } from '../middleware/errorHandler';

// ============================================
// CREATE FX RATE
// ============================================
export const createFXRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from_currency, to_currency, rate, notes } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    if (!from_currency || !to_currency || !rate) {
      throw new AppError('Required: from_currency, to_currency, rate', 400, 'MISSING_FIELDS');
    }

    if (from_currency === to_currency) {
      throw new AppError('Currencies must be different', 400, 'SAME_CURRENCY');
    }

    if (typeof rate !== 'number' || rate <= 0) {
      throw new AppError('Rate must be a positive number', 400, 'INVALID_RATE');
    }

    const fxRate = new FXRate({
      from_currency: from_currency.toUpperCase(),
      to_currency: to_currency.toUpperCase(),
      rate,
      effective_from: new Date(),
      updated_by: userId,
      source: 'admin_manual',
      notes: notes || null,
    });

    await fxRate.save();

    res.status(201).json({
      success: true,
      message: 'FX rate created',
      data: fxRate,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET ALL FX RATES
// ============================================
export const getFXRates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { include_inactive } = req.query;

    const filter: any = {};
    // Sahi se boolean check (string to boolean)
    if (include_inactive !== 'true') {
      filter.is_active = true;
    }

    // Addition of maxTimeMS to prevent hanging and lean() for speed
    const rates = await FXRate.find(filter)
      .lean()
      .maxTimeMS(3000);

    res.json({
      success: true,
      count: rates.length,
      data: rates,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// UPDATE FX RATE
// ============================================
export const updateFXRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { rate, notes } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    if (!rate || typeof rate !== 'number' || rate <= 0) {
      throw new AppError('Rate must be a positive number', 400, 'INVALID_RATE');
    }

    const fxRate = await FXRate.findById(id);

    if (!fxRate) {
      throw new AppError('FX rate not found', 404, 'NOT_FOUND');
    }

    const oldRate = fxRate.rate;
    fxRate.rate = rate;
    fxRate.updated_by = userId;
    fxRate.notes = notes || fxRate.notes;

    await fxRate.save();

    res.json({
      success: true,
      message: 'FX rate updated',
      data: fxRate,
      old_rate: oldRate,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DEACTIVATE FX RATE
// ============================================
export const deactivateFXRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const fxRate = await FXRate.findById(id);

    if (!fxRate) {
      throw new AppError('FX rate not found', 404, 'NOT_FOUND');
    }

    fxRate.is_active = false;
    await fxRate.save();

    res.json({
      success: true,
      message: 'FX rate deactivated',
      data: fxRate,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET CURRENT FX RATES (PUBLIC)
// ============================================
export const getCurrentFXRates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rates = await FXRate.find({
      is_active: true,
      effective_from: { $lte: new Date() },
    });

    // Convert to map { AUD: 1.0, USD: 0.65, INR: 54.25 }
    const rateMap: Record<string, number> = { 'AUD': 1.0 };

    for (const rate of rates) {
      if (rate.from_currency === 'AUD') {
        rateMap[rate.to_currency] = rate.rate;
      }
    }

    res.json({
      success: true,
      data: rateMap,
      last_updated: rates.length > 0 ? rates[0].updatedAt : new Date(),
    });
  } catch (error) {
    next(error);
  }
};
