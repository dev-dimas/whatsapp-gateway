import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { API_KEY } from "../util/environment";
import logger from "../util/logger";

/**
 * Middleware to verify API key for protected routes
 */
export const verifyApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip if no API_KEY is configured
  if (!API_KEY) {
    logger.warn("API_KEY not configured, skipping authentication");
    return next();
  }

  const apiKey = req.header("X-API-Key") || req.query.apiKey;

  if (!apiKey) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: "API key is required",
      errors: null,
    });
  }

  if (apiKey !== API_KEY) {
    return res.status(StatusCodes.FORBIDDEN).json({
      statusCode: StatusCodes.FORBIDDEN,
      message: "Invalid API key",
      errors: null,
    });
  }

  next();
};

/**
 * Optional API key verification (doesn't block if no key provided)
 */
export const optionalApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip if no API_KEY is configured
  if (!API_KEY) {
    return next();
  }

  const apiKey = req.header("X-API-Key") || req.query.apiKey;

  // If API key is provided, verify it
  if (apiKey && apiKey !== API_KEY) {
    return res.status(StatusCodes.FORBIDDEN).json({
      statusCode: StatusCodes.FORBIDDEN,
      message: "Invalid API key",
      errors: null,
    });
  }

  next();
};
