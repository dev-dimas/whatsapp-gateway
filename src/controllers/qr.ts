import { Request, Response } from "express";
import QRCode from "qrcode";
import logger from "../util/logger";
import { PATH_BASE } from "../util/environment";

/**
 * Get QR code
 * @route GET /qr (legacy)
 * @route GET /accounts/:accountId/qr (multi-account)
 */
export const getQrCode = async (req: Request, res: Response) => {
  const accountId = req.params.accountId;

  // Multi-account mode
  if (accountId && req.waManager) {
    const status = await req.waManager.GetAccountStatus(accountId);

    if (!status) {
      return res.render("qr/info", {
        title: "QR Code",
        message: "Account not found",
        pathBase: PATH_BASE,
      });
    }

    if (status.needRestart) {
      return res.render("qr/info", {
        title: "QR Code",
        message: `Account ${status.accountName} - Client Logged Out`,
        pathBase: PATH_BASE,
      });
    }

    if (status.isConnected) {
      logger.info(`[${accountId}] client connected`);
      return res.render("qr/info", {
        title: "QR Code",
        message: `Account ${status.accountName} - Connected to ${status.phoneNumber}`,
        pathBase: PATH_BASE,
      });
    }

    if (status.qrcode) {
      QRCode.toDataURL(
        status.qrcode,
        (err: Error | null | undefined, url: string) => {
          if (err) {
            logger.error(`[${accountId}] QR code error:`, err.message);
            return res.render("qr/info", {
              title: "QR Code",
              message: err.message,
              pathBase: PATH_BASE,
            });
          } else {
            return res.render("qr/index", {
              title: "QR Code",
              url: url,
              accountName: status.accountName,
              pathBase: PATH_BASE,
            });
          }
        }
      );
      return;
    }

    return res.render("qr/info", {
      title: "QR Code",
      message: `Account ${status.accountName} - Status: ${status.status}`,
      pathBase: PATH_BASE,
    });
  }

  return res.status(503).render("qr/info", {
    title: "QR Code",
    message: "WhatsApp service not available",
    pathBase: PATH_BASE,
  });
};
