import type { UserRole } from '../generated/prisma/enums.js';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  policyName: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
