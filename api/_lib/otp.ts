import crypto from "crypto";

export type OtpPurpose = "signup" | "reset";

export interface OtpDoc {
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: number;   // ms timestamp
    attemptsLeft: number;
    lastSentAt: number;
}

export const OTP_TTL_MS = 10 * 60 * 1000;     // 10 минут
export const OTP_ATTEMPTS = 6;                // попыток
export const RESEND_COOLDOWN_MS = 45 * 1000;  // антиспам

export const makeCode = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

export const sha256 = (s: string) =>
    crypto.createHash("sha256").update(s).digest("hex");
