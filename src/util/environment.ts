import logger from "./logger";
import dotenv from "dotenv";
import fs from "fs";
import { makeString } from "./random-generator";

if (fs.existsSync(".env")) {
  logger.debug("Using .env file to supply config environment variables");
  dotenv.config({ path: ".env" });
} else {
  logger.debug(
    "Using .env.example file to supply config environment variables"
  );
  dotenv.config({ path: ".env.example" }); // you can delete this after you create your own .env file!
}

export const ENVIRONMENT = process.env.NODE_ENV;

export const SESSION_SECRET: string =
  process.env["SESSION_SECRET"] ?? makeString();
export const DB_CONNECTION_STRING: string | undefined =
  process.env["DB_CONNECTION_STRING"];
export const PATH_BASE: string = process.env["PATH_BASE"] ?? "";

// Multi-Account Settings
export const MAX_ACCOUNTS: number = parseInt(
  process.env["MAX_ACCOUNTS"] ?? "10",
  10
);
export const MAX_MESSAGES_PER_HOUR: number = parseInt(
  process.env["MAX_MESSAGES_PER_HOUR"] ?? "50",
  10
);
export const MAX_MESSAGES_PER_DAY: number = parseInt(
  process.env["MAX_MESSAGES_PER_DAY"] ?? "500",
  10
);
export const MESSAGE_DELAY_MIN: number = parseInt(
  process.env["MESSAGE_DELAY_MIN"] ?? "3000",
  10
);
export const MESSAGE_DELAY_MAX: number = parseInt(
  process.env["MESSAGE_DELAY_MAX"] ?? "8000",
  10
);
export const ACCOUNT_INIT_DELAY: number = parseInt(
  process.env["ACCOUNT_INIT_DELAY"] ?? "30000",
  10
);
export const MAX_CONCURRENT_SENDING: number = parseInt(
  process.env["MAX_CONCURRENT_SENDING"] ?? "3",
  10
);
export const API_KEY: string | undefined = process.env["API_KEY"];
