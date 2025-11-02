import compression from "compression";
import express, { NextFunction, Request, Response } from "express";
import flash from "express-flash";
import session from "express-session";
import path from "path";
import { databaseConnect } from "./config/database";
import { verifyApiKey } from "./middleware/auth";
import { WhatsappAccountManager } from "./services/whatsapp-account-manager";
import {
  DB_CONNECTION_STRING,
  PATH_BASE,
  SESSION_SECRET,
} from "./util/environment";

// Controllers (route handlers)
import * as accountController from "./controllers/account";
import * as homeController from "./controllers/home";
import * as messageController from "./controllers/message";
import * as qrController from "./controllers/qr";
import * as statusController from "./controllers/status";

// Connect Database
databaseConnect(DB_CONNECTION_STRING);

// Create Express Server
const app = express();

// Services - Multi-Account Manager
const waManager = new WhatsappAccountManager();
waManager.Initialize();

const exposeWhatsappManager = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.waManager = waManager;
  next();
};

// Express configuration
app.set("port", process.env.PORT || 80);
app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "pug");

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    resave: true,
    saveUninitialized: true,
    secret: SESSION_SECRET as string,
  })
);
app.use(flash());

app.use(
  express.static(path.join(__dirname, "public"), { maxAge: 31557600000 })
);

/**
 * Primary app routes.
 */
const router = express.Router();

// Home
router.get("/", homeController.index);

// Multi-account management routes (protected with API key)
router.post(
  "/accounts",
  verifyApiKey,
  exposeWhatsappManager,
  accountController.createAccount
);
router.get(
  "/accounts",
  verifyApiKey,
  exposeWhatsappManager,
  accountController.listAccounts
);
router.get(
  "/accounts/:accountId",
  verifyApiKey,
  exposeWhatsappManager,
  accountController.getAccount
);
router.delete(
  "/accounts/:accountId",
  verifyApiKey,
  exposeWhatsappManager,
  accountController.deleteAccount
);

// Multi-account operation routes
router.get(
  "/accounts/:accountId/qr",
  exposeWhatsappManager,
  qrController.getQrCode
);
router.get(
  "/accounts/:accountId/status",
  exposeWhatsappManager,
  statusController.getStatus
);
router.post(
  "/accounts/:accountId/message",
  verifyApiKey,
  exposeWhatsappManager,
  messageController.postMessage
);
router.post(
  "/accounts/:accountId/message/image",
  verifyApiKey,
  exposeWhatsappManager,
  messageController.postImageMessage
);
router.post(
  "/accounts/:accountId/message/document",
  verifyApiKey,
  exposeWhatsappManager,
  messageController.postDocumentMessage
);

app.use(PATH_BASE, router);

export default app;
