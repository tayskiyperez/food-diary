import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "./firebase.ts";
import { initNotifications } from "./notifications";

import {
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendEmailVerification,
} from "firebase/auth";

import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";

import AuthScreen from "./components/AuthScreen";
import DiaryTab from "./components/tabs/DiaryTab";
import FoodTab from "./components/tabs/FoodTab";
import ReportsTab from "./components/tabs/ReportsTab";
import ProfileTab from "./components/tabs/ProfileTab";
import SettingsModal from "./components/SettingsModal";
import AddProductModal from "./components/AddProductModal";
import { IconPlus } from "./components/icons/Icons";

const SYMPTOMS_NONE = "Нет высыпаний";
const SYMPTOMS_YES = "Есть высыпивания";

const BUILTIN_FOODS = [
    "Молоко", "Хлеб", "Яйцо", "Яблоко", "Курица",
    "Рыба", "Сыр", "Кофе", "Чай", "Банан",
    "Гречка", "Овсянка", "Рис", "Картофель", "Помидор",
];

const toKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};
const fromKey = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
};
const todayDate = () => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};
const formatDate = (d) =>
    d.toLocaleDateString("ru-RU", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

function top5Suggestions(dict, query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [];
    const starts = dict.filter((s) => s.toLowerCase().startsWith(q));
    const contains = dict.filter(
        (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q)
    );
    return [...starts, ...contains]
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5);
}

function computeScores(entries) {
    const scores = new Map();

    Object.values(entries).forEach((day) => {
        if (!day) return;

        const foods = Array.isArray(day.foods) ? day.foods : [];
        if (foods.length === 0) return; 

        const symptoms = (day.symptoms || "").trim();

        
        
        const hasSymptoms = symptoms && symptoms !== SYMPTOMS_NONE;
        const delta = hasSymptoms ? 1 : -1;

        foods.forEach((f) => {
            if (!f || !f.name) return;
            scores.set(f.name, (scores.get(f.name) || 0) + delta);
        });
    });

    return scores;
}


export default function App() {
    
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false); 
    const [emailVerified, setEmailVerified] = useState(true);
    useEffect(() => {
        
        if (!user) return;

        
        initNotifications();
    }, [user]);


    
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [theme, setTheme] = useState(
        () => localStorage.getItem("theme_pref") || "system"
    );

    const resolveTheme = (pref) => {
        if (pref === "dark") return "dark";
        if (pref === "light") return "light";
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark";
        }
        return "light";
    };

    function applyTheme(next) {
        const root = document.documentElement;
        const resolved = resolveTheme(next);
        root.classList.toggle("dark", resolved === "dark");
    }

    useEffect(() => {
        localStorage.setItem("theme_pref", theme);
        applyTheme(theme);

        if (theme !== "system") return undefined;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const listener = () => applyTheme("system");
        mediaQuery.addEventListener("change", listener);
        return () => mediaQuery.removeEventListener("change", listener);
    }, [theme]);

    
    const [tab, setTab] = useState("diary"); 
    const [selectedDay, setSelectedDay] = useState(todayDate());

    const [entries, setEntries] = useState(() => {
        try {
            const raw = localStorage.getItem("entries_v1");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Ошибка чтения entries_v1 при старте", e);
        }

        
        return {
            [toKey(todayDate())]: { foods: [], symptoms: "" },
        };
    });

    const [initialSynced, setInitialSynced] = useState(false);

    
    const [notificationSettings, setNotificationSettings] = useState(() => {
        try {
            const raw = localStorage.getItem("notification_settings_v1");
            if (raw) return JSON.parse(raw);
        } catch {}
        return {
            foodEnabled: true,
            foodIntervalHours: 6,
            symptomsEnabled: true, 
        };
    });

    
    
    const [customFoods, setCustomFoods] = useState(() => {
        try {
            const raw = localStorage.getItem("custom_foods_v1");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch { }
        return [];
    });

    useEffect(() => {
        try {
            localStorage.setItem(
                "custom_foods_v1",
                JSON.stringify(customFoods)
            );
        } catch { }
    }, [customFoods]);


    useEffect(() => {
        try {
            localStorage.setItem(
                "notification_settings_v1",
                JSON.stringify(notificationSettings)
            );
        } catch {}
    }, [notificationSettings]);

    useEffect(() => {
        if (!user) return; 

        if (typeof Notification === "undefined") return;
        if (Notification.permission === "default") {
            Notification.requestPermission().catch(() => { });
        }
    }, [user]);

    
    const [dict, setDict] = useState([]);
    const [baseDict, setBaseDict] = useState([]);

    
    useEffect(() => {
        fetch("/product.json")
            .then((r) => (r.ok ? r.json() : BUILTIN_FOODS))
            .then((arr) => {
                const data = Array.isArray(arr) ? arr : BUILTIN_FOODS;
                const unique = Array.from(
                    new Set(
                        data
                            .map((s) => String(s).trim())
                            .filter(Boolean)
                    )
                );
                setBaseDict(unique); 
                setDict(unique);     
            })
            .catch(() => {
                setBaseDict(BUILTIN_FOODS);
                setDict(BUILTIN_FOODS);
            });
    }, []);

    
    useEffect(() => {
        setDict(() => {
            const base = Array.isArray(baseDict) ? baseDict : [];
            const extra = Array.isArray(customFoods)
                ? customFoods
                    .map((item) => String(item.name || "").trim())
                    .filter(Boolean)
                : [];

            return Array.from(new Set([...base, ...extra]));
        });
    }, [customFoods, baseDict]);

    
    const [usageDays, setUsageDays] = useState(() => {
        const raw = localStorage.getItem("usageDays");
        return raw ? JSON.parse(raw) : [];
    });
    const syncingRef = useRef(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (fbUser) => {
            setUser(fbUser || null);
            setEmailVerified(fbUser ? !!fbUser.emailVerified : true);
            setAuthChecked(true);
        });
        return () => unsub();
    }, []);

    
    useEffect(() => {
        if (!user) return;

        const ref = doc(db, "users", user.uid);

        (async () => {
            try {
                const snap = await getDoc(ref);

                
                const localEntries = entries || {};
                const hasLocalData = Object.values(localEntries).some((day) => {
                    const foodsOk =
                        Array.isArray(day.foods) && day.foods.length > 0;
                    const symptomsOk =
                        typeof day.symptoms === "string" &&
                        day.symptoms.trim() !== "";
                    return foodsOk || symptomsOk;
                });

                if (snap.exists()) {
                    const data = snap.data() || {};
                    const cloudEntries =
                        data.entries && typeof data.entries === "object"
                            ? data.entries
                            : {};
                    const hasCloudData = Object.values(cloudEntries).some(
                        (day) => {
                            const foodsOk =
                                Array.isArray(day.foods) &&
                                day.foods.length > 0;
                            const symptomsOk =
                                typeof day.symptoms === "string" &&
                                day.symptoms.trim() !== "";
                            return foodsOk || symptomsOk;
                        }
                    );

                    if (!hasLocalData && hasCloudData) {
                        
                        setEntries(cloudEntries);
                        try {
                            localStorage.setItem(
                                "entries_v1",
                                JSON.stringify(cloudEntries)
                            );
                        } catch (e) {
                            console.error(
                                "Ошибка записи entries_v1 при загрузке из облака",
                                e
                            );
                        }
                    } else if (!hasLocalData && !hasCloudData) {
                        
                        await setDoc(
                            ref,
                            {
                                entries: localEntries,
                                usageDays,
                                updatedAt: serverTimestamp(),
                            },
                            { merge: true }
                        );
                    } else if (hasLocalData && !hasCloudData) {
                        
                        await setDoc(
                            ref,
                            {
                                entries: localEntries,
                                usageDays,
                                updatedAt: serverTimestamp(),
                            },
                            { merge: true }
                        );
                    } else {
                        
                        
                        setEntries(cloudEntries);
                        try {
                            localStorage.setItem(
                                "entries_v1",
                                JSON.stringify(cloudEntries)
                            );
                        } catch (e) {
                            console.error(
                                "Ошибка записи entries_v1 при синхронизации из облака",
                                e
                            );
                        }
                    }
                } else {
                    
                    await setDoc(
                        ref,
                        {
                            entries: localEntries,
                            usageDays,
                            updatedAt: serverTimestamp(),
                        },
                        { merge: true }
                    );
                }
            } catch (e) {
                console.error("Firestore sync init error:", e);
            }
        })();
        
    }, [user]);


    useEffect(() => {
        const k = toKey(todayDate());
        setUsageDays((prev) => {
            if (prev.includes(k)) return prev;
            const next = [...prev, k];
            localStorage.setItem("usageDays", JSON.stringify(next));
            return next;
        });
    }, []);

    
    const [productInput, setProductInput] = useState("");
    const [symptomsInput, setSymptomsInput] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [plusOpen, setPlusOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [expandedDays, setExpandedDays] = useState(() => new Set());

    const dayKey = toKey(selectedDay);
    const current = entries[dayKey] || { foods: [], symptoms: "" };

    useEffect(() => {
        setSymptomsInput(current.symptoms || "");
    }, [dayKey]); 

    const ensureDay = (d) =>
        setEntries((prev) => ({
            ...prev,
            [toKey(d)]: prev[toKey(d)] || { foods: [], symptoms: "" },
        }));

    const addFoodToSelected = (name, dayOverride) => {
        const clean = (name || "").trim();
        if (!clean) return;

        const day = dayOverride || selectedDay;
        const key = toKey(day);

        
        const custom = customFoods.find(
            (item) => item.name.trim().toLowerCase() === clean.toLowerCase()
        );

        
        const ingredients =
            custom && Array.isArray(custom.ingredients) && custom.ingredients.length
                ? custom.ingredients
                : null;

        setEntries((prev) => {
            const dayData = prev[key] || { foods: [], symptoms: "" };
            const foods = Array.isArray(dayData.foods) ? dayData.foods : [];

            let newFoods = [];

            if (ingredients) {
                
                newFoods = ingredients
                    .map((ingRaw) => {
                        const ing = (ingRaw || "").trim();
                        if (!ing) return null;
                        return {
                            id:
                                (typeof crypto !== "undefined" &&
                                    crypto.randomUUID &&
                                    crypto.randomUUID()) ||
                                Math.random().toString(36).slice(2),
                            name: ing,
                        };
                    })
                    .filter(Boolean);
            } else {
                
                newFoods = [
                    {
                        id:
                            (typeof crypto !== "undefined" &&
                                crypto.randomUUID &&
                                crypto.randomUUID()) ||
                            Math.random().toString(36).slice(2),
                        name: clean,
                    },
                ];
            }

            return {
                ...prev,
                [key]: {
                    ...dayData,
                    foods: [...newFoods, ...foods],
                },
            };
        });

        try {
            localStorage.setItem("last_food_add_at", String(Date.now()));
        } catch { }

        setProductInput("");
        setShowSuggestions(false);
        setHighlightIndex(0);
    };

    
    useEffect(() => {
        if (typeof Notification === "undefined") return;
        if (Notification.permission !== "granted") return;
        if (!notificationSettings.foodEnabled) return;

        const intervalMs =
            notificationSettings.foodIntervalHours * 60 * 60 * 1000;

        const checkFoodReminder = () => {
            let lastFood = 0;
            try {
                const raw = localStorage.getItem("last_food_add_at");
                if (raw) lastFood = Number(raw) || 0;
            } catch {}

            if (!lastFood) return;

            const now = Date.now();
            const diff = now - lastFood;

            if (diff < intervalMs) return;

            const todayKey = toKey(todayDate());
            let lastFoodReminder = "";
            try {
                lastFoodReminder =
                    localStorage.getItem("last_food_reminder_for_day") || "";
            } catch {}

            if (lastFoodReminder === todayKey) return;

            try {
                new Notification("Пищевой дневник", {
                    body: `Ты не записывал еду уже ${notificationSettings.foodIntervalHours} часов — добавить приём пищи?`,
                    tag: "food-reminder",
                });
                localStorage.setItem(
                    "last_food_reminder_for_day",
                    todayKey
                );
            } catch {}
        };

        checkFoodReminder();
        const id = setInterval(checkFoodReminder, 15 * 60 * 1000);

        return () => clearInterval(id);
    }, [notificationSettings]);

    
    useEffect(() => {
        if (typeof Notification === "undefined") return;
        if (Notification.permission !== "granted") return;
        if (!notificationSettings.symptomsEnabled) return;

        const checkSymptomsReminder = () => {
            const now = new Date();
            const hour = now.getHours();

            if (hour < 20 || hour > 23) return;

            const todayKey = toKey(todayDate());
            const todayEntry = entries[todayKey];

            if (!todayEntry || !(todayEntry.foods?.length)) return;

            const s = (todayEntry.symptoms || "").trim();
            const hasAnySymptomsChoice = s.length > 0;

            if (hasAnySymptomsChoice) return;

            let lastSymReminder = "";
            try {
                lastSymReminder =
                    localStorage.getItem(
                        "last_symptoms_reminder_for_day"
                    ) || "";
            } catch {}

            if (lastSymReminder === todayKey) return;

            try {
                new Notification("Пищевой дневник", {
                    body: "Сегодня вы ели, но ещё не отметили симптомы. Всё ли было в порядке?",
                    tag: "symptoms-reminder",
                });
                localStorage.setItem(
                    "last_symptoms_reminder_for_day",
                    todayKey
                );
            } catch {}
        };

        const id = setInterval(checkSymptomsReminder, 30 * 60 * 1000);
        checkSymptomsReminder();

        return () => clearInterval(id);
    }, [notificationSettings, entries]);

    
    useEffect(() => {
        try {
            localStorage.setItem("entries_v1", JSON.stringify(entries));
        } catch (e) {
            console.error("Ошибка записи entries_v1 в localStorage", e);
        }
    }, [entries]);

    
    useEffect(() => {
        if (!user) return; 

        const ref = doc(db, "users", user.uid);

        (async () => {
            try {
                await setDoc(
                    ref,
                    {
                        entries,
                        usageDays,
                        updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                );
            } catch (e) {
                console.error("Firestore write error:", e);
            }
        })();
    }, [user, entries, usageDays]);

    const deleteFood = (id, dayOverride) => {
        const day = dayOverride || selectedDay;
        const key = toKey(day);

        setEntries((prev) => {
            const dayData = prev[key];
            if (!dayData) return prev;

            const foods = Array.isArray(dayData.foods) ? dayData.foods : [];
            const nextFoods = foods.filter((f) => f.id !== id);

            
            if (nextFoods.length === foods.length) return prev;

            return {
                ...prev,
                [key]: {
                    ...dayData,
                    foods: nextFoods,
                },
            };
        });
    };

    const saveSymptoms = () => {
        const valid =
            symptomsInput === SYMPTOMS_NONE || symptomsInput === SYMPTOMS_YES;
        if (!valid) {
            setToastMsg("Выберите симптомы");
            setTimeout(() => setToastMsg(""), 1600);
            return;
        }
        setEntries((prev) => {
            const day = prev[dayKey] || { foods: [], symptoms: "" };
            return {
                ...prev,
                [dayKey]: { ...day, symptoms: symptomsInput },
            };
        });
        setToastMsg("Симптомы сохранены");
        setTimeout(() => setToastMsg(""), 1600);
    };

    const filteredSuggestions = useMemo(
        () => top5Suggestions(dict, productInput),
        [dict, productInput]
    );

    const productStats = useMemo(() => {
        const map = new Map();
        Object.values(entries).forEach((d) =>
            (d.foods || []).forEach((f) =>
                map.set(f.name, (map.get(f.name) || 0) + 1)
            )
        );
        return Array.from(map.entries()).map(([name, count]) => ({
            name,
            count,
        }));
    }, [entries]);

    const scores = useMemo(() => computeScores(entries), [entries]);
    const grouped = useMemo(() => {
        const red = [],
            yellow = [],
            green = [];
        productStats.forEach((p) => {
            const s = scores.get(p.name) || 0;
            if (s >= 7) red.push(p);
            else if (s >= 3) yellow.push(p);
            else green.push(p);
        });
        return { red, yellow, green };
    }, [productStats, scores]);

    const MIN_SAMPLES = 3;

    const countMap = useMemo(() => {
        const m = new Map();
        productStats.forEach((p) => m.set(p.name, p.count));
        return m;
    }, [productStats]);

    function chipTone(name) {
        const count = countMap.get(name) || 0;
        if (count < MIN_SAMPLES) return "neutral";

        const s = scores.get(name) || 0;
        if (s >= 7) return "red";
        if (s >= 3) return "yellow";
        return "green";
    }

    function chipClass(name) {
        const tone = chipTone(name);
        switch (tone) {
            case "red":
                return "bg-rose-50 border-rose-200 text-rose-800";
            case "yellow":
                return "bg-yellow-50 border-yellow-200 text-yellow-800";
            case "green":
                return "bg-emerald-50 border-emerald-200 text-emerald-800";
            default:
                return "bg-white border-gray-200 text-gray-800";
        }
    }

    const daysWithFood = useMemo(
        () =>
            Object.entries(entries).filter(
                ([, d]) => (d.foods?.length || 0) > 0
            ),
        [entries]
    );
    const daysWithSymptoms = useMemo(
        () =>
            daysWithFood.filter(([, d]) => {
                const s = (d.symptoms || "").trim();
                return s !== "" && s !== SYMPTOMS_NONE;
            }),
        [daysWithFood]
    );
    const daysWithoutSymptoms = useMemo(
        () =>
            daysWithFood.filter(([, d]) => {
                const s = (d.symptoms || "").trim();
                return s === "" || s === SYMPTOMS_NONE;
            }),
        [daysWithFood]
    );

    
    const [daySwipeDir, setDaySwipeDir] = useState(null); 
    const touchStartX = useRef(null);
    const touchMoveX = useRef(null);

    const shiftDay = (delta) => {
        const d = new Date(selectedDay);
        d.setDate(d.getDate() + delta);
        setSelectedDay(d);
        ensureDay(d);
    };
    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchMoveX.current = null;
    };
    const handleTouchMove = (e) => {
        touchMoveX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = () => {
        if (touchStartX.current == null || touchMoveX.current == null) return;
        const dx = touchMoveX.current - touchStartX.current;
        if (Math.abs(dx) > 50) {
            if (dx < 0) {
                setDaySwipeDir("left");
                shiftDay(1);
            } else {
                setDaySwipeDir("right");
                shiftDay(-1);
            }
            setTimeout(() => setDaySwipeDir(null), 300);
        }
        touchStartX.current = null;
        touchMoveX.current = null;
    };

    
    const tabs = ["diary", "food", "reports", "profile"];
    const [prevTab, setPrevTab] = useState("diary");
    const setTabWithAnim = (next) => {
        setPrevTab(tab);
        setTab(next);
    };
    const tabAnimClass = (() => {
        const from = tabs.indexOf(prevTab);
        const to = tabs.indexOf(tab);
        if (from === to) return "";
        return to > from ? "animate-swipe-left" : "animate-swipe-right";
    })();

    

    if (!authChecked) {
        return null;
    }

    const signOutUser = () => signOut(auth);

    if (!user) {
        return <AuthScreen />;
    }

    if (user && !emailVerified) {
        return (
            <div className="min-h-screen app-shell app-card flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center app-surface">
                    <h2 className="text-xl font-bold mb-2">
                        Подтвердите email
                    </h2>
                    <p className="mb-4 text-gray-600">
                        На ваш email{" "}
                        <span className="font-semibold">{user.email}</span>{" "}
                        отправлено письмо с подтверждением.
                        <br />
                        Перейдите по ссылке в письме, затем обновите страницу.
                    </p>
                    <button
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 transition mb-2"
                        onClick={async () => {
                            try {
                                await sendEmailVerification(user, {
                                    url: window.location.origin,
                                    handleCodeInApp: false,
                                });
                                alert("Письмо отправлено повторно.");
                            } catch {
                                alert("Не удалось отправить письмо.");
                            }
                        }}
                    >
                        Отправить письмо ещё раз
                    </button>
                    <button
                        className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold shadow-sm hover:bg-gray-800 transition"
                        onClick={() => signOut(auth)}
                    >
                        Выйти
                    </button>
                </div>
            </div>
        );
    }

    

    const toggleDayExpand = (k) => {
        setExpandedDays((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    };

    
    const clearAllData = async () => {
        if (!window.confirm("Удалить все записи дневника? Это действие нельзя отменить.")) {
            return;
        }

        
        setEntries({});
        setUsageDays([]);

        
        try {
            localStorage.removeItem("entries_v1");
            localStorage.removeItem("usageDays");
        } catch (e) {
            console.error("Ошибка очистки localStorage", e);
        }

        
        if (user) {
            try {
                const ref = doc(db, "users", user.uid);
                await setDoc(
                    ref,
                    {
                        entries: {},
                        usageDays: [],
                        updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                );
            } catch (e) {
                console.error("Ошибка очистки дневника в Firestore", e);
            }
        }

        setToastMsg("Данные дневника очищены");
        setTimeout(() => setToastMsg(""), 1600);
    };

    return (
        <div className="min-h-screen bg-gray-50 relative app-shell app-card">
            <div
                className={`fixed top-3 inset-x-0 z-50 flex justify-center transition-transform duration-300 ${toastMsg ? "translate-y-0" : "-translate-y-24"
                    }`}
            >
                {toastMsg && (
                    <div className="px-4 py-2 bg-gray-900 text-white rounded-full shadow">
                        {toastMsg}
                    </div>
                )}
            </div>

            <div className="mx-auto w-full max-w-[480px] min-h-screen flex flex-col pb-16">
                <header className="px-5 pt-5 pb-3 border-b sticky top-0 bg-white/95 backdrop-blur z-10 app-surface">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold">
                                Пищевой дневник
                            </h1>
                            <div className="mt-1 text-xs text-gray-500">
                                {formatDate(selectedDay)}
                            </div>
                        </div>
                        <button
                            className="p-2 rounded-xl hover:bg-gray-100 transition focus:outline-none"
                            title="Настройки"
                            onClick={() => setSettingsOpen(true)}
                            style={{ WebkitTapHighlightColor: "transparent" }}
                        >
                            <img
                                src="/icons/settings.png"
                                alt="Настройки"
                                className={`w-6 h-6 transition-transform duration-300 ${settingsOpen ? "rotate-90" : "rotate-0"
                                    }`}
                            />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto">
                    <div className={tabAnimClass}>
                        {tab === "diary" && (
                            <DiaryTab
                                ctx={{
                                    selectedDay,
                                    setSelectedDay,
                                    toKey,
                                    fromKey,
                                    todayDate,
                                    formatDate,
                                    ensureDay,
                                    productInput,
                                    setProductInput,
                                    showSuggestions,
                                    setShowSuggestions,
                                    highlightIndex,
                                    setHighlightIndex,
                                    filteredSuggestions,
                                    addFoodToSelected,
                                    current,
                                    deleteFood,
                                    SYMPTOMS_NONE,
                                    SYMPTOMS_YES,
                                    symptomsInput,
                                    setSymptomsInput,
                                    saveSymptoms,
                                    handleTouchStart,
                                    handleTouchMove,
                                    handleTouchEnd,
                                    daySwipeDir,
                                    setPlusOpen,
                                }}
                            />
                        )}

                        {tab === "food" && <FoodTab ctx={{ grouped }} />}

                        {tab === "reports" && (
                            <ReportsTab
                                ctx={{
                                    daysWithSymptoms,
                                    daysWithoutSymptoms,
                                    expandedDays,
                                    toggleDayExpand,
                                    formatDate,
                                    fromKey,
                                    chipClass,
                                }}
                            />
                        )}

                        {tab === "profile" && (
                            <ProfileTab
                                ctx={{
                                    usageDays,
                                    entries,
                                    setEntries,
                                    userEmail:
                                        (user && user.email) ||
                                        auth.currentUser?.email ||
                                        "",
                                    sendPasswordResetEmail,
                                    setToastMsg,
                                    signOutUser,
                                    clearAllData,
                                }}
                            />
                        )}
                    </div>
                </main>
            </div>

            <nav className="fixed bottom-0 inset-x-0 h-16 bg-white border-t shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-40 app-surface">
                <div className="mx-auto w-full max-w-[480px] h-full">
                    <div className="grid grid-cols-5 text-[11px] h-full">
                        <button
                            className={`h-full flex flex-col items-center justify-center gap-1 ${tab === "diary"
                                    ? "text-blue-600 font-semibold"
                                    : "text-gray-500"
                                }`}
                            onClick={() => setTabWithAnim("diary")}
                        >
                            <img
                                src={`/icons/diary${tab === "diary" ? "-active" : ""
                                    }.png`}
                                alt="Дневник"
                                className="w-6 h-6"
                            />
                            <span>Дневник</span>
                        </button>

                        <button
                            className={`h-full flex flex-col items-center justify-center gap-1 ${tab === "food"
                                    ? "text-blue-600 font-semibold"
                                    : "text-gray-500"
                                }`}
                            onClick={() => setTabWithAnim("food")}
                        >
                            <img
                                src={`/icons/food${tab === "food" ? "-active" : ""
                                    }.png`}
                                alt="Еда"
                                className="w-6 h-6"
                            />
                            <span>Еда</span>
                        </button>

                        <div className="h-full flex items-center justify-center">
                            <button
                                className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-2xl ring-1 ring-black/5 -translate-y-3 grid place-items-center hover:scale-105 active:scale-95 transition"
                                onClick={() => {
                                    setPlusOpen(true);
                                    setProductInput("");
                                    setShowSuggestions(false);
                                }}
                                title="Добавить продукт"
                            >
                                <IconPlus />
                            </button>
                        </div>

                        <button
                            className={`h-full flex flex-col items-center justify-center gap-1 ${tab === "reports"
                                    ? "text-blue-600 font-semibold"
                                    : "text-gray-500"
                                }`}
                            onClick={() => setTabWithAnim("reports")}
                        >
                            <img
                                src={`/icons/reports${tab === "reports" ? "-active" : ""
                                    }.png`}
                                alt="Отчёты"
                                className="w-6 h-6"
                            />
                            <span>Отчёты</span>
                        </button>

                        <button
                            className={`h-full flex flex-col items-center justify-center gap-1 ${tab === "profile"
                                    ? "text-blue-600 font-semibold"
                                    : "text-gray-500"
                                }`}
                            onClick={() => setTabWithAnim("profile")}
                        >
                            <img
                                src={`/icons/profile${tab === "profile" ? "-active" : ""
                                    }.png`}
                                alt="Профиль"
                                className="w-6 h-6"
                            />
                            <span>Профиль</span>
                        </button>
                    </div>
                </div>
            </nav>

            <AddProductModal
                ctx={{
                    plusOpen,
                    setPlusOpen,
                    productInput,
                    setProductInput,
                    showSuggestions,
                    setShowSuggestions,
                    highlightIndex,
                    setHighlightIndex,
                    dict,
                    addFoodToSelected,
                    top5Suggestions,
                    selectedDay,
                    customFoods,
                    setCustomFoods,
                }}
            />

            <SettingsModal
                open={settingsOpen}
                theme={theme}
                setTheme={setTheme}
                notificationSettings={notificationSettings}
                setNotificationSettings={setNotificationSettings}
                onClose={() => setSettingsOpen(false)}
            />
        </div>
    );
}