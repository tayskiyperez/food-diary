import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";
import { z } from "zod";
import { auth, db } from "./_lib/firebase";
import { OtpDoc, OTP_ATTEMPTS, OTP_TTL_MS, RESEND_COOLDOWN_MS, makeCode, sha256 } from "./_lib/otp";

const Email = z.string().email().max(254);
const Purpose = z.enum(["signup", "reset"]);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const APP_NAME = process.env.APP_NAME || "Пищевой дневник";
const MAIL_FROM = process.env.MAIL_FROM || `"${APP_NAME}" <no-reply@yourdomain.tld>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const { email, purpose } = z.object({ email: Email, purpose: Purpose }).parse(req.body);

        const docRef = db.collection("email_otps").doc(email);
        const prev = await docRef.get();
        const now = Date.now();

        if (prev.exists) {
            const d = prev.data() as OtpDoc | undefined;
            if (d && d.lastSentAt && now - d.lastSentAt < RESEND_COOLDOWN_MS) {
                const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - d.lastSentAt)) / 1000);
                res.status(429).json({ error: `Подождите ${wait} сек. перед повторной отправкой.` });
                return;
            }
        }

        const code = makeCode();
        await docRef.set({
            codeHash: sha256(code),
            purpose,
            expiresAt: now + OTP_TTL_MS,
            attemptsLeft: OTP_ATTEMPTS,
            lastSentAt: now,
        } as OtpDoc);

        const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;">
        <h2>${APP_NAME}</h2>
        <p>Код подтверждения (действителен 10 минут):</p>
        <div style="font-size:32px;letter-spacing:6px;font-weight:700">${code}</div>
        <p style="color:#666">Если вы не запрашивали код, игнорируйте это письмо.</p>
      </div>
    `;

        await transporter.sendMail({
            from: MAIL_FROM,
            to: email,
            subject: `Ваш код — ${APP_NAME}`,
            html,
            text: `Код: ${code} (действителен 10 минут)`,
        });

        res.status(200).json({ ok: true });
    } catch (e: any) {
        res.status(400).json({ error: e?.message || "Ошибка отправки кода" });
    }
}
