import type { SessionDoc } from '../models/Session';
import type { UserDoc } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: UserDoc;
        session: SessionDoc;
        hasPassword: boolean;
      };
    }
  }
}

export {};
