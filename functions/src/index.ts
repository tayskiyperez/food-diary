import * as functions from "firebase-functions"; // Gen1 (Spark OK)
import * as admin from "firebase-admin";
import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { z } from "zod";

// --- Admin SDK ---
admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

// --- Типы для OTP ---
type OtpPurpose = "signup" | "reset";
interface OtpDoc {
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: number; // ms timestamp
    attemptsLeft: number;
    lastSentAt: number;
}

// --- Константы ---
const OTP_TTL_MS = 10 * 60 * 1000;      // 10 минут
const OTP_ATTEMPTS = 6;                 // попыток
const RESEND_COOLDOWN_MS = 45 * 1000;   // антиспам на повторную отправку

const makeCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// --- Валидация входа ---
const Email = z.string().email().max(254);
const Purpose = z.enum(["signup", "reset"]);

// --- Конфиг через Runtime Config (CLI) с fallback на process.env ---
const cfg = functions.config();
const SMTP_HOST = process.env.SMTP_HOST || cfg.smtp?.host;
const SMTP_PORT = Number(process.env.SMTP_PORT || cfg.smtp?.port || 587);
const SMTP_USER = process.env.SMTP_USER || cfg.smtp?.user;
const SMTP_PASS = process.env.SMTP_PASS || cfg.smtp?.pass;
const APP_NAME = process.env.APP_NAME || cfg.app?.name || "Пищевой дневник";
const MAIL_FROM =
    process.env.MAIL_FROM || cfg.mail?.from || `"${APP_NAME}" <no-reply@yourdomain.tld>`;

// --- SMTP транспорт ---
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
});

// --- Express-приложение ---
const app = express();
app.use(express.json());

// === 1) Отправка кода ===
app.post("/auth/send-code", async (req, res): Promise<void> => {
    try {
        const { email, purpose } = z
            .object({ email: Email, purpose: Purpose })
            .parse(req.body);

        const docRef = db.collection("email_otps").doc(email);
        const prev = await docRef.get();
        const now = Date.now();

        if (prev.exists) {
            const d = prev.data() as OtpDoc | undefined;
            if (d && d.lastSentAt && now - d.lastSentAt < RESEND_COOLDOWN_MS) {
                const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - d.lastSentAt)) / 1000);
                res.status(429).send({ error: `Подождите ${wait} сек. перед повторной отправкой.` });
                return;
            }
        }

        const code = makeCode();
        await docRef.set({
            codeHash: sha256(code),
            purpose,
            expiresAt: now + OTP_TTL_MS,
            attemptsLeft: OTP_ATTEMPTS,
            lastSentAt: now
        });

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
            text: `Код: ${code} (действителен 10 минут)`
        });

        res.send({ ok: true });
        return;
    } catch {
        res.status(400).send({ error: "Ошибка отправки кода" });
        return;
    }
});

// === 2) Проверка кода и выдача custom token ===
app.post("/auth/verify-code", async (req, res): Promise<void> => {
    try {
        const { email, code } = z
            .object({ email: Email, code: z.string().regex(/^\d{6}$/) })
            .parse(req.body);

        const ref = db.collection("email_otps").doc(email);
        const snap = await ref.get();
        if (!snap.exists) {
            res.status(400).send({ error: "Код не найден. Запросите новый." });
            return;
        }
        const data = snap.data() as OtpDoc;
        const now = Date.now();

        if (now > data.expiresAt) {
            await ref.delete();
            res.status(400).send({ error: "Код истёк. Запросите новый." });
            return;
        }
        if (data.attemptsLeft <= 0) {
            await ref.delete();
            res.status(400).send({ error: "Слишком много попыток. Запросите новый код." });
            return;
        }
        if (sha256(code) !== data.codeHash) {
            await ref.update({ attemptsLeft: data.attemptsLeft - 1 });
            res.status(400).send({ error: "Неверный код." });
            return;
        }

        await ref.delete();

        // Создать/найти пользователя в Firebase Auth
        let user: admin.auth.UserRecord | null = null;
        try {
            user = await auth.getUserByEmail(email);
        } catch {
            user = await auth.createUser({ email, emailVerified: true });
        }
        if (user && !user.emailVerified) {
            await auth.updateUser(user.uid, { emailVerified: true });
        }

        const token = await auth.createCustomToken(user!.uid);

        // (опционально) создать профиль в Firestore users/{uid} — если его нет
        const userDoc = db.collection("users").doc(user!.uid);
        const userSnap = await userDoc.get();
        if (!userSnap.exists) {
            await userDoc.set({
                email,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.send({ ok: true, token, purpose: data.purpose || "signup" });
        return;
    } catch {
        res.status(400).send({ error: "Ошибка проверки кода" });
        return;
    }
});

// --- Экспорт GEN1 (без Blaze) ---
export const api = functions.region("europe-west1").https.onRequest(app);
