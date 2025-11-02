/* eslint-disable @typescript-eslint/no-explicit-any */
import { Boom } from "@hapi/boom";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay,
  AnyMessageContent,
  AuthenticationState,
  Browsers,
} from "@whiskeysockets/baileys";
import { FormatToPhoneNumber, FormatToWhatsappJid } from "../util/formatter";
import * as fs from "fs";
import * as path from "path";
import * as msgProcessorService from "../services/msg-processor-service";
import logger from "../util/logger";
import { Account, AccountDocument } from "../models/account";
import { RateLimiterService } from "./rate-limiter-service";
import {
  MAX_ACCOUNTS,
  MAX_MESSAGES_PER_HOUR,
  MAX_MESSAGES_PER_DAY,
  MESSAGE_DELAY_MIN,
  MESSAGE_DELAY_MAX,
  MAX_CONCURRENT_SENDING,
  ACCOUNT_INIT_DELAY,
} from "../util/environment";

interface WhatsappInstanceStatus {
  isConnected: boolean;
  phoneNumber: string;
  qrcode: string;
  needRestart: boolean;
  accountId: string;
  accountName: string;
  status: string;
  messageStats?: {
    hourlyCount: number;
    dailyCount: number;
    hourlyLimit: number;
    dailyLimit: number;
  };
}

class WhatsappInstance {
  accountId: string;
  accountName: string;
  qrcode: string = "";
  phoneNumber: string = "";
  needRestartService: boolean = false;
  sock: any;
  state: AuthenticationState | null = null;
  saveCreds: any;
  sessionPath: string;
  isInitializing: boolean = false;

  constructor(accountId: string, accountName: string, sessionPath: string) {
    this.accountId = accountId;
    this.accountName = accountName;
    this.sessionPath = sessionPath;
  }

  async Initialize() {
    if (this.isInitializing) {
      logger.warn(`Account ${this.accountId} is already initializing`);
      return;
    }
    this.isInitializing = true;
    try {
      this.sock = await this.CreateNewSocket();
    } finally {
      this.isInitializing = false;
    }
  }

  async CreateNewSocket() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(
      `[${this.accountId}] Using wa version v${version.join(
        "."
      )}, isLatest: ${isLatest}`
    );

    // Ensure session directory exists
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
    this.state = state;
    this.saveCreds = saveCreds;

    const socket = makeWASocket({
      version: version,
      printQRInTerminal: false,
      auth: state,
      markOnlineOnConnect: true,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
    });

    // autoreconnect
    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, isNewLogin, qr } = update;

      logger.info(
        `[${
          this.accountId
        }] connection update: ${connection}, isNewLogin: ${isNewLogin}, qr: ${
          qr !== undefined
        }`
      );

      if (qr !== undefined) {
        logger.info(`[${this.accountId}] gets qr code`);
        this.qrcode = qr as string;
        await this.updateAccountStatus("connecting");
      }

      // closed connection
      if (connection == "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        logger.info(
          `[${this.accountId}] connection closed due to`,
          lastDisconnect?.error,
          statusCode
        );

        if (statusCode !== DisconnectReason.loggedOut) {
          await this.updateAccountStatus("disconnected");
          // Exponential backoff reconnection
          await delay(5000);
          this.sock = await this.CreateNewSocket();
        } else {
          fs.rmSync(this.sessionPath, { recursive: true, force: true });
          this.needRestartService = true;
          await this.updateAccountStatus("logged_out");
          logger.info(`[${this.accountId}] client logged out`);
        }
      }
      // opened connection
      else if (connection == "open") {
        logger.info(`[${this.accountId}] opened connection`);
        this.phoneNumber = FormatToPhoneNumber(state.creds.me?.id as string);
        this.qrcode = "";
        await this.updateAccountStatus("connected", this.phoneNumber);
      }
    });

    socket.ev.on("creds.update", this.saveCreds);

    socket.ev.on("chats.upsert", (item) =>
      logger.info(`[${this.accountId}] recv ${item.length} chats`)
    );
    socket.ev.on("chats.update", (m) =>
      logger.debug(`[${this.accountId}] chats.update event`, m)
    );
    socket.ev.on("chats.delete", (m) =>
      logger.debug(`[${this.accountId}] chats.delete event`, m)
    );

    socket.ev.on("contacts.upsert", (item) =>
      logger.info(`[${this.accountId}] recv ${item.length} contacts`)
    );
    socket.ev.on("contacts.update", (m) =>
      logger.debug(`[${this.accountId}] contacts.update event`, m)
    );

    socket.ev.on("messages.upsert", async (m) => {
      logger.info(`[${this.accountId}] messages.upsert event`, m);

      m.messages.forEach(async (message) => {
        // skip message if the message sent by me
        if (message.key.fromMe) {
          return;
        }
        // process the message
        const result = await msgProcessorService.Process(message);
        if (result.needReply) {
          await this.SendWhatsappSimpleMessage(
            message.key.remoteJid,
            result.message as AnyMessageContent
          );
        }
      });
    });

    socket.ev.on("messages.update", (m) =>
      logger.debug(`[${this.accountId}] messages.update event`, m)
    );
    socket.ev.on("message-receipt.update", (m) =>
      logger.debug(`[${this.accountId}] message-receipt.update event`, m)
    );
    socket.ev.on("presence.update", (m) =>
      logger.debug(`[${this.accountId}] presence.update event`, m)
    );

    return socket;
  }

  async SendWhatsappSimpleMessage(
    phoneNumber: string | null | undefined,
    message: AnyMessageContent
  ) {
    logger.info(
      `[${this.accountId}] Sending To: ${phoneNumber} with message: ${message}`
    );

    const jid = FormatToWhatsappJid(phoneNumber);
    logger.info(`[${this.accountId}] Formatted jid to: ${jid}`);

    await this.sock.presenceSubscribe(jid);
    await delay(500);
    await this.sock.sendPresenceUpdate("composing", jid);
    await delay(1000);
    await this.sock.sendPresenceUpdate("paused", jid);
    await delay(500);
    await this.sock.sendMessage(jid, {
      text: message,
    });
    await this.sock.sendPresenceUpdate("available", jid);
  }

  async SendWhatsappMediaMessage(
    phoneNumber: string | null | undefined,
    file: Express.Multer.File,
    filetype: string,
    caption: string
  ) {
    logger.info(
      `[${this.accountId}] Sending To: ${phoneNumber} with file: ${file.originalname}`
    );

    const jid = FormatToWhatsappJid(phoneNumber);
    logger.info(`[${this.accountId}] Formatted jid to: ${jid}`);

    await this.sock.presenceSubscribe(jid);
    await delay(500);
    await this.sock.sendPresenceUpdate("composing", jid);
    await delay(1500);
    await this.sock.sendPresenceUpdate("paused", jid);
    await delay(500);

    if (filetype === "image") {
      await this.sock.sendMessage(jid, {
        image: file.buffer,
        caption: caption,
      });
    } else if (filetype === "document") {
      await this.sock.sendMessage(jid, {
        document: file.buffer,
        mimetype: file.mimetype,
        fileName: file.originalname,
        caption: caption,
      });
    }
    await this.sock.sendPresenceUpdate("available", jid);
  }

  GetStatus(): WhatsappInstanceStatus {
    const baseStatus = {
      accountId: this.accountId,
      accountName: this.accountName,
    };

    if (this.needRestartService) {
      return {
        ...baseStatus,
        isConnected: false,
        phoneNumber: "",
        qrcode: "",
        needRestart: true,
        status: "logged_out",
      };
    }
    if (this.qrcode === "") {
      return {
        ...baseStatus,
        isConnected: true,
        phoneNumber: this.phoneNumber,
        qrcode: "",
        needRestart: false,
        status: "connected",
      };
    }
    return {
      ...baseStatus,
      isConnected: false,
      phoneNumber: "",
      qrcode: this.qrcode,
      needRestart: false,
      status: "connecting",
    };
  }

  async Cleanup() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (error) {
      logger.error(`[${this.accountId}] Error during cleanup:`, error);
    }
  }

  private async updateAccountStatus(status: string, phoneNumber?: string) {
    try {
      const updateData: any = { status };
      if (status === "connected") {
        updateData.lastConnected = new Date();
        if (phoneNumber) {
          updateData.phoneNumber = phoneNumber;
        }
      }
      await Account.findOneAndUpdate({ accountId: this.accountId }, updateData);
    } catch (error) {
      logger.error(`[${this.accountId}] Error updating account status:`, error);
    }
  }
}

export class WhatsappAccountManager {
  private instances: Map<string, WhatsappInstance> = new Map();
  private rateLimiter: RateLimiterService;
  private isInitialized: boolean = false;

  constructor() {
    this.rateLimiter = new RateLimiterService({
      maxMessagesPerHour: MAX_MESSAGES_PER_HOUR,
      maxMessagesPerDay: MAX_MESSAGES_PER_DAY,
      minMessageDelay: MESSAGE_DELAY_MIN,
      maxMessageDelay: MESSAGE_DELAY_MAX,
      maxConcurrentSending: MAX_CONCURRENT_SENDING,
    });
  }

  async Initialize() {
    if (this.isInitialized) {
      logger.warn("WhatsappAccountManager already initialized");
      return;
    }

    logger.info("Initializing WhatsappAccountManager...");

    // Load existing accounts from database
    try {
      const accounts = await Account.find({ isActive: true });
      logger.info(`Found ${accounts.length} active accounts in database`);

      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        logger.info(
          `Initializing account ${i + 1}/${accounts.length}: ${
            account.accountId
          } (${account.name})`
        );

        const instance = new WhatsappInstance(
          account.accountId,
          account.name,
          account.sessionPath
        );
        this.instances.set(account.accountId, instance);

        // Initialize with delay to prevent rate limiting
        await instance.Initialize();

        // Add delay between account initializations
        if (i < accounts.length - 1) {
          logger.info(
            `Waiting ${ACCOUNT_INIT_DELAY}ms before initializing next account...`
          );
          await delay(ACCOUNT_INIT_DELAY);
        }
      }

      this.isInitialized = true;
      logger.info("WhatsappAccountManager initialized successfully");
    } catch (error) {
      logger.error("Error initializing WhatsappAccountManager:", error);
      throw error;
    }
  }

  async CreateAccount(
    accountId: string,
    name: string
  ): Promise<{ success: boolean; message: string; account?: AccountDocument }> {
    try {
      // Check max accounts limit
      const activeCount = await Account.countDocuments({ isActive: true });
      if (activeCount >= MAX_ACCOUNTS) {
        return {
          success: false,
          message: `Maximum account limit (${MAX_ACCOUNTS}) reached`,
        };
      }

      // Check if account already exists
      const existing = await Account.findOne({ accountId });
      if (existing) {
        return {
          success: false,
          message: "Account ID already exists",
        };
      }

      // Create session path
      const sessionPath = path.join(
        process.cwd(),
        "data",
        "sessions",
        accountId
      );

      // Create account in database
      const account = await Account.create({
        accountId,
        name,
        sessionPath,
        status: "disconnected",
        isActive: true,
      });

      // Create WhatsApp instance
      const instance = new WhatsappInstance(accountId, name, sessionPath);
      this.instances.set(accountId, instance);

      // Initialize with delay
      await delay(2000);
      await instance.Initialize();

      logger.info(`Created new account: ${accountId} (${name})`);

      return {
        success: true,
        message: "Account created successfully",
        account,
      };
    } catch (error) {
      logger.error("Error creating account:", error);
      return {
        success: false,
        message: `Error creating account: ${error}`,
      };
    }
  }

  async DeleteAccount(
    accountId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const instance = this.instances.get(accountId);
      if (instance) {
        await instance.Cleanup();
        this.instances.delete(accountId);
      }

      // Remove session directory
      const account = await Account.findOne({ accountId });
      if (account && fs.existsSync(account.sessionPath)) {
        fs.rmSync(account.sessionPath, { recursive: true, force: true });
      }

      // Mark as inactive in database
      await Account.findOneAndUpdate(
        { accountId },
        { isActive: false, status: "disconnected" }
      );

      // Reset rate limiter stats
      this.rateLimiter.resetStats(accountId);

      logger.info(`Deleted account: ${accountId}`);

      return {
        success: true,
        message: "Account deleted successfully",
      };
    } catch (error) {
      logger.error("Error deleting account:", error);
      return {
        success: false,
        message: `Error deleting account: ${error}`,
      };
    }
  }

  GetAccount(accountId: string): WhatsappInstance | undefined {
    return this.instances.get(accountId);
  }

  async ListAccounts(): Promise<WhatsappInstanceStatus[]> {
    const statuses: WhatsappInstanceStatus[] = [];

    for (const [accountId, instance] of this.instances) {
      const status = instance.GetStatus();
      const messageStats = this.rateLimiter.getStats(accountId);
      statuses.push({
        ...status,
        messageStats,
      });
    }

    return statuses;
  }

  async GetAccountStatus(
    accountId: string
  ): Promise<WhatsappInstanceStatus | null> {
    const instance = this.instances.get(accountId);
    if (!instance) {
      return null;
    }

    const status = instance.GetStatus();
    const messageStats = this.rateLimiter.getStats(accountId);

    return {
      ...status,
      messageStats,
    };
  }

  async SendMessage(
    accountId: string,
    phoneNumber: string,
    message: AnyMessageContent
  ): Promise<{ success: boolean; message: string; waitTime?: number }> {
    const instance = this.instances.get(accountId);
    if (!instance) {
      return {
        success: false,
        message: "Account not found",
      };
    }

    // Check if connected
    const status = instance.GetStatus();
    if (!status.isConnected) {
      return {
        success: false,
        message: `Account not connected. Status: ${status.status}`,
      };
    }

    // Check rate limit
    const rateLimitCheck = this.rateLimiter.canSendMessage(accountId);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: rateLimitCheck.reason || "Rate limit exceeded",
        waitTime: rateLimitCheck.waitTime,
      };
    }

    try {
      // Mark as sending
      this.rateLimiter.startSending(accountId);

      // Add random delay for natural behavior
      const randomDelay = this.rateLimiter.getRandomDelay();
      logger.info(
        `[${accountId}] Adding delay of ${randomDelay}ms before sending message`
      );
      await delay(randomDelay);

      // Send message
      await instance.SendWhatsappSimpleMessage(phoneNumber, message);

      // Record message
      this.rateLimiter.recordMessage(accountId);

      return {
        success: true,
        message: "Message sent successfully",
      };
    } catch (error) {
      logger.error(`[${accountId}] Error sending message:`, error);
      return {
        success: false,
        message: `Error sending message: ${error}`,
      };
    } finally {
      // Mark as finished
      this.rateLimiter.finishSending(accountId);
    }
  }

  async SendMediaMessage(
    accountId: string,
    phoneNumber: string,
    file: Express.Multer.File,
    filetype: string,
    caption: string
  ): Promise<{ success: boolean; message: string; waitTime?: number }> {
    const instance = this.instances.get(accountId);
    if (!instance) {
      return {
        success: false,
        message: "Account not found",
      };
    }

    // Check if connected
    const status = instance.GetStatus();
    if (!status.isConnected) {
      return {
        success: false,
        message: `Account not connected. Status: ${status.status}`,
      };
    }

    // Check rate limit
    const rateLimitCheck = this.rateLimiter.canSendMessage(accountId);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: rateLimitCheck.reason || "Rate limit exceeded",
        waitTime: rateLimitCheck.waitTime,
      };
    }

    try {
      // Mark as sending
      this.rateLimiter.startSending(accountId);

      // Add random delay for natural behavior
      const randomDelay = this.rateLimiter.getRandomDelay();
      logger.info(
        `[${accountId}] Adding delay of ${randomDelay}ms before sending media`
      );
      await delay(randomDelay);

      // Send message
      await instance.SendWhatsappMediaMessage(
        phoneNumber,
        file,
        filetype,
        caption
      );

      // Record message
      this.rateLimiter.recordMessage(accountId);

      return {
        success: true,
        message: "Media sent successfully",
      };
    } catch (error) {
      logger.error(`[${accountId}] Error sending media:`, error);
      return {
        success: false,
        message: `Error sending media: ${error}`,
      };
    } finally {
      // Mark as finished
      this.rateLimiter.finishSending(accountId);
    }
  }

  async Shutdown() {
    logger.info("Shutting down WhatsappAccountManager...");
    for (const [accountId, instance] of this.instances) {
      logger.info(`Cleaning up account: ${accountId}`);
      await instance.Cleanup();
    }
    this.instances.clear();
    logger.info("WhatsappAccountManager shutdown complete");
  }
}
