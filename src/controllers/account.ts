import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { StatusCodes, ReasonPhrases } from "http-status-codes";
import { Account } from "../models/account";
import logger from "../util/logger";

/**
 * Create new account
 * @route POST /accounts
 */
export const createAccount = async (req: Request, res: Response) => {
  await body("accountId")
    .notEmpty()
    .withMessage("Account ID cannot be blank!")
    .matches("^[a-zA-Z0-9_-]+$")
    .withMessage(
      "Account ID can only contain letters, numbers, hyphens, and underscores"
    )
    .trim()
    .run(req);

  await body("name")
    .notEmpty()
    .withMessage("Account name cannot be blank!")
    .trim()
    .run(req);

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      message: ReasonPhrases.BAD_REQUEST,
      errors: errors.array(),
    });
  }

  const { accountId, name } = req.body;

  try {
    const result = await req.waManager!.CreateAccount(accountId, name);

    if (!result.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        statusCode: StatusCodes.BAD_REQUEST,
        message: result.message,
        errors: null,
      });
    }

    return res.status(StatusCodes.CREATED).json({
      statusCode: StatusCodes.CREATED,
      message: "Account created successfully",
      data: {
        accountId: result.account?.accountId,
        name: result.account?.name,
        status: result.account?.status,
        createdAt: result.account?.createdAt,
      },
    });
  } catch (error) {
    logger.error("Error creating account:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      errors: null,
    });
  }
};

/**
 * List all accounts
 * @route GET /accounts
 */
export const listAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await req.waManager!.ListAccounts();

    return res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      message: ReasonPhrases.OK,
      data: accounts,
    });
  } catch (error) {
    logger.error("Error listing accounts:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      errors: null,
    });
  }
};

/**
 * Get account details
 * @route GET /accounts/:accountId
 */
export const getAccount = async (req: Request, res: Response) => {
  const { accountId } = req.params;

  try {
    const account = await Account.findOne({ accountId, isActive: true });

    if (!account) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        message: "Account not found",
        errors: null,
      });
    }

    const status = await req.waManager!.GetAccountStatus(accountId);

    return res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      message: ReasonPhrases.OK,
      data: {
        ...account.toObject(),
        connectionStatus: status,
      },
    });
  } catch (error) {
    logger.error("Error getting account:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      errors: null,
    });
  }
};

/**
 * Delete account
 * @route DELETE /accounts/:accountId
 */
export const deleteAccount = async (req: Request, res: Response) => {
  const { accountId } = req.params;

  try {
    const result = await req.waManager!.DeleteAccount(accountId);

    if (!result.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        statusCode: StatusCodes.BAD_REQUEST,
        message: result.message,
        errors: null,
      });
    }

    return res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      message: "Account deleted successfully",
      data: null,
    });
  } catch (error) {
    logger.error("Error deleting account:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      errors: null,
    });
  }
};

/**
 * Get account status
 * @route GET /accounts/:accountId/status
 */
export const getAccountStatus = async (req: Request, res: Response) => {
  const { accountId } = req.params;

  try {
    const status = await req.waManager!.GetAccountStatus(accountId);

    if (!status) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        message: "Account not found",
        errors: null,
      });
    }

    return res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      message: ReasonPhrases.OK,
      data: status,
    });
  } catch (error) {
    logger.error("Error getting account status:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      errors: null,
    });
  }
};
