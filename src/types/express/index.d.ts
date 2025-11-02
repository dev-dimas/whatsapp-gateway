import { WhatsappAccountManager } from "../../services/whatsapp-account-manager";

declare global {
  namespace Express {
    export interface Request {
      waManager?: WhatsappAccountManager;
    }
  }
}
