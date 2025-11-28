import React, { useEffect, useState, useRef, useMemo } from "react";
import { auth, provider } from "../firebase.ts";
import {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithCredential,
} from "firebase/auth";
import { SocialLogin } from "@capgo/capacitor-social-login";


const WEB_CLIENT_ID = "319230754547-ecsvq2a2m9vguneh18unq8ar5ob8pp3t.apps.googleusercontent.com";


function calcPasswordStrength(password) {
    if (!password) {
        return {
            strength: 0,
            strengthLabel: "Не задан",
            strengthBarClass: "bg-gray-300",
        };
    }

    const hasLower = /[a-zа-я]/.test(password);
    const hasUpper = /[A-ZА-Я]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^A-Za-zА-Яа-я0-9]/.test(password);

    const typesCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean)
        .length;

    let strength = typesCount; 
    if (strength < 0) strength = 0;
    if (strength > 4) strength = 4;

    let strengthLabel = "Очень слабый";
    let strengthBarClass = "bg-red-600";

    if (strength === 0 || strength === 1) {
        strengthLabel = "Очень слабый";
        strengthBarClass = "bg-red-600";
    } else if (strength === 2) {
        strengthLabel = "Слабый";
        strengthBarClass = "bg-orange-500";
    } else if (strength === 3) {
        strengthLabel = "Средний";
        strengthBarClass = "bg-yellow-400";
    } else if (strength === 4) {
        strengthLabel = "Сильный";
        strengthBarClass = "bg-emerald-600";
    }

    return { strength, strengthLabel, strengthBarClass };
}

export default function AuthScreen() {
    const redirectHandledRef = useRef(false);

    const [mode, setMode] = useState("signin"); 
    const [error, setError] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [passValue, setPassValue] = useState("");

    const { strength, strengthLabel, strengthBarClass } = useMemo(
        () => calcPasswordStrength(passValue),
        [passValue]
    );

    
    useEffect(() => {
        if (redirectHandledRef.current) return;
        redirectHandledRef.current = true;
        (async () => {
            try {
                await getRedirectResult(auth);
            } catch {
                
            }
        })();
    }, []);

    
    useEffect(() => {
        if (!WEB_CLIENT_ID) return;
        
        SocialLogin.initialize({
            google: {
                webClientId: WEB_CLIENT_ID,
            },
        }).catch(() => {
            
        });
    }, []);

    const signInEmail = async (e) => {
        e.preventDefault();
        setError("");
        const email = e.target.email.value.trim();
        const pass = passValue;
        if (!email || !pass) {
            setError("Введите email и пароль");
            return;
        }
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch {
            setError("Неверный логин или пароль");
        }
    };

    const signUpEmail = async (e) => {
        e.preventDefault();
        setError("");
        const email = e.target.email.value.trim();
        const pass = passValue;
        if (!email || !pass) {
            setError("Введите email и пароль");
            return;
        }
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await sendEmailVerification(cred.user, {
                url: window.location.origin,
                handleCodeInApp: false,
            });
            alert(
                "Мы отправили письмо с подтверждением на ваш email. Перейдите по ссылке в письме, затем вернитесь в приложение."
            );
        } catch (err) {
            setError(err?.message || "Ошибка регистрации");
        }
    };

    const signInGoogle = async () => {
        setError("");

        const isNative =
            typeof window !== "undefined" &&
            window.Capacitor?.isNativePlatform?.();
            window.Capacitor.isNativePlatform();

        try {
            if (isNative) {
                
                const res = await SocialLogin.login({
                    provider: "google",
                    options: {},
                });

                console.log("SocialLogin result:", res);

                if (!res || res.provider !== "google" || !res.result) {
                    setError("Native Google: пустой ответ от плагина");
                    return;
                }

                
                const idToken = res.result.idToken;
                if (!idToken) {
                    setError("Native Google: не удалось получить idToken");
                    return;
                }

                console.log("Google idToken (native):", idToken?.slice?.(0, 30) + "...");

                const credential = GoogleAuthProvider.credential(idToken);
                await signInWithCredential(auth, credential);
            } else {
                
                try {
                    await signInWithPopup(auth, provider);
                } catch (e) {
                    console.error("WEB Google error:", e);
                    const code = e?.code || "";
                    const shouldRedirect =
                        code === "auth/operation-not-supported-in-this-environment" ||
                        code === "auth/popup-blocked" ||
                        code === "auth/cancelled-popup-request";
                    if (shouldRedirect) {
                        await signInWithRedirect(auth, provider);
                        return;
                    }
                    setError(e?.code || e?.message || "Не удалось войти через Google.");
                    return;
                }
            }
        } catch (e) {
            console.error("Native Google+Firebase error:", e);
            
            setError(e?.code || e?.message || "Ошибка при входе через Google.");
        }
    };

    return (
        <div className="min-h-screen bg-white flex justify-center py-6 app-shell app-card">
            <div className="w-full max-w-[420px] min-h-[calc(100vh-3rem)] bg-white flex flex-col app-surface">
                <header className="px-5 pt-5 pb-3 border-b bg-white/95 backdrop-blur app-surface">
                    <h1 className="text-xl font-bold text-center">Пищевой дневник</h1>
                    <div className="mt-1 text-xs text-gray-500 text-center">
                        Вход и регистрация
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto px-5 py-6">
                    <div className="max-w-[360px] mx-auto space-y-3">
                        {error ? (
                            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
                                {error}
                            </div>
                        ) : null}

                        {mode === "signin" ? (
                            <form onSubmit={signInEmail} className="space-y-4">
                                <input
                                    name="email"
                                    placeholder="Email"
                                    className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                                    autoComplete="username"
                                />

                                <div className="relative">
                                    <input
                                        type={showPass ? "text" : "password"}
                                        name="password"
                                        placeholder="Пароль"
                                        className="w-full border rounded-xl p-3 pr-10 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                                        autoComplete="current-password"
                                        value={passValue}
                                        onChange={(e) => setPassValue(e.target.value)}
                                    />
                                    {passValue && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPass((v) => !v)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                                            title={
                                                showPass ? "Скрыть пароль" : "Показать пароль"
                                            }
                                        >
                                            <img
                                                src={
                                                    showPass
                                                        ? "/icons/eye-off.svg"
                                                        : "/icons/eye.svg"
                                                }
                                                alt={
                                                    showPass
                                                        ? "Скрыть пароль"
                                                        : "Показать пароль"
                                                }
                                                className="w-5 h-5 opacity-80"
                                            />
                                        </button>
                                    )}
                                </div>

                                <button className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:shadow-md hover:bg-blue-700 active:scale-[0.99] transition">
                                    Войти
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={signUpEmail} className="space-y-4">
                                <input
                                    name="email"
                                    placeholder="Email"
                                    className="w-full border rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                                    autoComplete="username"
                                />
                                <div className="relative">
                                    <input
                                        type={showPass ? "text" : "password"}
                                        name="password"
                                        placeholder="Пароль (мин. 6)"
                                        className="w-full border rounded-xl p-3 pr-10 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                                        autoComplete="new-password"
                                        value={passValue}
                                        onChange={(e) => setPassValue(e.target.value)}
                                    />
                                    {passValue && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPass((v) => !v)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
                                            title={
                                                showPass ? "Скрыть пароль" : "Показать пароль"
                                            }
                                        >
                                            <img
                                                src={
                                                    showPass
                                                        ? "/icons/eye-off.svg"
                                                        : "/icons/eye.svg"
                                                }
                                                alt={
                                                    showPass
                                                        ? "Скрыть пароль"
                                                        : "Показать пароль"
                                                }
                                                className="w-5 h-5 opacity-80"
                                            />
                                        </button>
                                    )}
                                </div>

                                {passValue && (
                                    <div className="mt-1">
                                        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                            <div
                                                className={`h-full ${strengthBarClass} transition-all`}
                                                style={{
                                                    width: `${(strength / 4) * 100}%`,
                                                }}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Надёжность: {strengthLabel}
                                        </div>
                                    </div>
                                )}

                                <button className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:shadow-md hover:bg-emerald-700 active:scale-[0.99] transition">
                                    Зарегистрироваться
                                </button>
                            </form>
                        )}

                        <button
                            onClick={() =>
                                setMode(mode === "signin" ? "signup" : "signin")
                            }
                            className="w-full py-3 rounded-xl border bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                            type="button"
                        >
                            {mode === "signin"
                                ? "Нет аккаунта? Зарегистрироваться"
                                : "Уже есть аккаунт? Войти"}
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-3 text-gray-500">или</span>
                            </div>
                        </div>

                        <button
                            onClick={signInGoogle}
                            className="w-full py-3 rounded-xl border bg-white hover:bg-gray-50 active:scale-[0.99] transition flex items-center justify-center gap-2"
                            type="button"
                        >
                            <img
                                src="/icons/google.png"
                                alt="Google"
                                className="w-5 h-5"
                            />
                            <span>Войти через Google</span>
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}