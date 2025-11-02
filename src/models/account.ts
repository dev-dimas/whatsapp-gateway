import mongoose from "mongoose";

export type AccountDocument = mongoose.Document & {
  accountId: string;
  name: string;
  phoneNumber: string;
  status: "connecting" | "connected" | "disconnected" | "banned" | "logged_out";
  sessionPath: string;
  lastConnected: Date;
  messageCount: number;
  lastMessageReset: Date;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

const accountSchema = new mongoose.Schema(
  {
    accountId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["connecting", "connected", "disconnected", "banned", "logged_out"],
      default: "disconnected",
    },
    sessionPath: {
      type: String,
      required: true,
    },
    lastConnected: {
      type: Date,
      default: null,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageReset: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export const Account = mongoose.model<AccountDocument>(
  "Account",
  accountSchema
);
