import { Request, Response } from "express";

/**
 * Get Status
 * @route /accounts/:accountId/status (multi-account)
 */
export const getStatus = async (req: Request, res: Response) => {
  const accountId = req.params.accountId;

  // Multi-account mode
  if (accountId && req.waManager) {
    const status = await req.waManager.GetAccountStatus(accountId);
    if (!status) {
      return res.status(404).json({
        statusCode: 404,
        message: "Account not found",
      });
    }
    return res.json(status);
  }

  return res.status(503).json({
    statusCode: 503,
    message: "WhatsApp service not available",
  });
};
