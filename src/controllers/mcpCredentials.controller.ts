import { Request, Response, NextFunction } from 'express';
import { McpConnector } from '../models';
import McpCredentials from '../models/McpCredentials.model';
import { AppError } from '../middleware/errorHandler';
import {
  encryptData,
  decryptData,
  generateAccessToken,
  calculateTokenExpiry,
  isTokenExpired,
} from '../utils/encryption';
import mongoose from 'mongoose';

const resolveConnector = async (connectorIdentifier: string) => {
  let connector = await McpConnector.findOne({ name: connectorIdentifier });

  if (!connector && mongoose.Types.ObjectId.isValid(connectorIdentifier)) {
    connector = await McpConnector.findById(connectorIdentifier);
  }

  if (!connector) {
    throw new AppError('Connector not found', 404, 'CONNECTOR_NOT_FOUND');
  }

  if (connector.isArchived) {
    throw new AppError('Connector is archived', 403, 'CONNECTOR_ARCHIVED');
  }

  return connector;
};

/**
 * GET /mcp/credentials/:connector
 * Any authenticated user can get access token for global credentials
 */
export const getCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const connectorIdentifier = req.params.connector as string;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!connectorIdentifier) {
      throw new AppError('Connector name is required', 400, 'MISSING_CONNECTOR');
    }

    const connector = await resolveConnector(connectorIdentifier);

    // ✅ Find GLOBAL credentials (userId = null)
    const credentials = await McpCredentials.findOne({
      userId: null,  // Global credentials only
      $or: [
        { connectorId: connector._id },
        { connectorName: connector.name }
      ],
      status: 'active',
    });

    if (!credentials) {
      throw new AppError(
        'No active credentials found for this connector. Please contact admin.',
        404,
        'CREDENTIALS_NOT_FOUND'
      );
    }

    if (isTokenExpired(credentials.tokenExpiresAt)) {
      credentials.status = 'expired';
      await credentials.save();
      throw new AppError(
        'Credentials token has expired. Admin needs to refresh credentials.',
        401,
        'TOKEN_EXPIRED'
      );
    }

    res.json({
      success: true,
      data: {
        accessToken: credentials.accessToken,
        expiresAt: credentials.tokenExpiresAt,
        connector: connector.name,
        connectorId: connector._id,
        accountInfo: credentials.credentialMetadata?.accountInfo,
        status: credentials.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /mcp/credentials
 * ADMIN ONLY - Store global credentials (no userId)
 */
export const storeCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const adminId = req.user?.userId;
    const { connectorId, credentials: rawCredentials, metadata } = req.body;

    if (!adminId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'FORBIDDEN');
    }

    if (!connectorId) {
      throw new AppError('Connector ID is required', 400, 'MISSING_CONNECTOR_ID');
    }

    if (!rawCredentials || typeof rawCredentials !== 'object' || Array.isArray(rawCredentials)) {
      throw new AppError('Credentials must be a JSON object', 400, 'INVALID_CREDENTIALS');
    }

    const mcpConnector = await resolveConnector(connectorId);

    // ✅ Find existing GLOBAL credentials
    let existingCredentials = await McpCredentials.findOne({
      userId: null,
      $or: [
        { connectorId: mcpConnector._id },
        { connectorName: mcpConnector.name }
      ],
    });

    const encryptedCredentials = encryptData(rawCredentials);
    const accessToken = generateAccessToken('global', mcpConnector.name);
    const tokenExpiresAt = calculateTokenExpiry(24);

    if (existingCredentials) {
      // Update existing
      existingCredentials.encryptedCredentials = encryptedCredentials;
      existingCredentials.accessToken = accessToken;
      existingCredentials.tokenExpiresAt = tokenExpiresAt;
      existingCredentials.status = 'active';
      existingCredentials.revokedAt = undefined;

      if (metadata) {
        existingCredentials.credentialMetadata = {
          ...existingCredentials.credentialMetadata,
          ...metadata,
          lastVerifiedAt: new Date(),
          isGlobal: true,
        };
      }

      await existingCredentials.save();

      res.status(200).json({
        success: true,
        message: 'Global credentials updated successfully',
        data: {
          connectorId: mcpConnector._id,
          connector: mcpConnector.name,
          accessToken: existingCredentials.accessToken,
          expiresAt: existingCredentials.tokenExpiresAt,
        },
      });
    } else {
      // Create new global credentials
      const newCredentials = new McpCredentials({
        userId: null,  // ✅ Global credentials
        connectorName: mcpConnector.name,
        connectorId: mcpConnector._id,
        encryptedCredentials,
        accessToken,
        tokenExpiresAt,
        status: 'active',
        credentialMetadata: {
          ...metadata,
          lastVerifiedAt: new Date(),
          isGlobal: true,
        },
      });

      await newCredentials.save();

      res.status(201).json({
        success: true,
        message: 'Global credentials stored successfully',
        data: {
          connectorId: mcpConnector._id,
          connector: mcpConnector.name,
          accessToken: newCredentials.accessToken,
          expiresAt: newCredentials.tokenExpiresAt,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /mcp/credentials
 * List all available global credentials
 */
export const listCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const credentials = await McpCredentials.find({
      userId: null,  // Only global credentials
      status: 'active',
    })
      .select('connectorName status tokenExpiresAt credentialMetadata.accountInfo createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: credentials.map(c => ({
        connector: c.connectorName,
        status: c.status,
        expiresAt: c.tokenExpiresAt,
        accountInfo: c.credentialMetadata?.accountInfo,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /mcp/credentials/verify/:accessToken
 * Internal - Decrypt and return credentials using access token
 * Called by Electron app (no auth required, token is the auth)
 */
export const getCredentialsByToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { accessToken } = req.params;

    if (!accessToken) {
      throw new AppError('Access token is required', 400, 'MISSING_TOKEN');
    }

    const credentials = await McpCredentials.findOne({
      accessToken,
      status: 'active',
    });

    if (!credentials) {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }

    if (isTokenExpired(credentials.tokenExpiresAt)) {
      credentials.status = 'expired';
      await credentials.save();
      throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
    }

    const decryptedCredentials = decryptData(credentials.encryptedCredentials);

    res.json({
      success: true,
      data: {
        credentials: decryptedCredentials,
        connector: credentials.connectorName,
        connectorId: credentials.connectorId,
        expiresAt: credentials.tokenExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /mcp/credentials/:connector
 * ADMIN ONLY - Revoke global credentials
 */
export const deleteCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const connectorIdentifier = req.params.connector as string;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'FORBIDDEN');
    }

    const connector = await resolveConnector(connectorIdentifier);

    const credentials = await McpCredentials.findOne({
      userId: null,
      $or: [
        { connectorId: connector._id },
        { connectorName: connector.name }
      ],
    });

    if (!credentials) {
      throw new AppError('Credentials not found for this connector', 404, 'CREDENTIALS_NOT_FOUND');
    }

    credentials.status = 'revoked';
    credentials.revokedAt = new Date();
    await credentials.save();

    res.json({
      success: true,
      message: 'Global credentials revoked successfully',
      data: {
        connector: credentials.connectorName,
        revokedAt: credentials.revokedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /mcp/credentials/:connector/refresh
 * ADMIN ONLY - Refresh access token
 */
export const refreshCredentialsToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    const connectorIdentifier = req.params.connector as string;

    if (!userId) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    if (req.user?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'FORBIDDEN');
    }

    const connector = await resolveConnector(connectorIdentifier);

    const credentials = await McpCredentials.findOne({
      userId: null,
      $or: [
        { connectorId: connector._id },
        { connectorName: connector.name }
      ],
      status: 'active',
    });

    if (!credentials) {
      throw new AppError('No active credentials found for this connector', 404, 'CREDENTIALS_NOT_FOUND');
    }

    const newAccessToken = generateAccessToken('global', connector.name);
    const newTokenExpiresAt = calculateTokenExpiry(24);

    credentials.accessToken = newAccessToken;
    credentials.tokenExpiresAt = newTokenExpiresAt;
    await credentials.save();

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        connector: connector.name,
        accessToken: newAccessToken,
        expiresAt: newTokenExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};