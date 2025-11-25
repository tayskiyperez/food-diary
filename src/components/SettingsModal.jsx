import React from "react";

export default function SettingsModal({
    open,
    theme,
    setTheme,
    notificationSettings,
    setNotificationSettings,
    onClose,
}) {
    if (!open) return null;

    
    
    const notif = notificationSettings || {
        foodEnabled: false,
        foodIntervalHours: 6,
        symptomsEnabled: false,
    };

    const setNotif =
        setNotificationSettings ||
        (() => {
           
        });

    const handleThemeChange = (value) => {
        if (!setTheme) return;
        setTheme(value);
    };

    return (
        <div className="fixed inset-0 z-[60] flex justify-center items-center bg-black/30">
            <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl overflow-hidden">
                <header className="relative px-4 py-3 border-b flex items-center justify-center">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-100 active:scale-95 transition"
                        aria-label="Закрыть настройки"
                    >
                        <span className="text-3xl leading-none">‹</span>
                    </button>

                    <h2 className="text-base font-semibold text-gray-900">
                        Настройки
                    </h2>
                </header>

                <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700">
                            Оформление
                        </h3>

                        <div className="mt-1">
                            <div className="relative bg-gray-100 rounded-2xl p-1 flex text-xs font-medium">
                                <div
                                    className="absolute top-1 bottom-1 w-1/3 rounded-2xl bg-white shadow-sm transition-transform duration-200"
                                    style={{
                                        transform:
                                            theme === "system"
                                                ? "translateX(0%)"
                                                : theme === "light"
                                                    ? "translateX(100%)"
                                                    : "translateX(200%)",
                                    }}
                                />

                                <button
                                    type="button"
                                    className="relative flex-1 py-2 text-center z-10"
                                    onClick={() => handleThemeChange("system")}
                                >
                                    <span
                                        className={
                                            theme === "system" ? "text-blue-600" : "text-gray-600"
                                        }
                                    >
                                        Система
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="relative flex-1 py-2 text-center z-10"
                                    onClick={() => handleThemeChange("light")}
                                >
                                    <span
                                        className={
                                            theme === "light" ? "text-blue-600" : "text-gray-600"
                                        }
                                    >
                                        Светлая
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="relative flex-1 py-2 text-center z-10"
                                    onClick={() => handleThemeChange("dark")}
                                >
                                    <span
                                        className={
                                            theme === "dark" ? "text-blue-600" : "text-gray-600"
                                        }
                                    >
                                        Тёмная
                                    </span>
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700">
                            Умные напоминания
                        </h3>

                        <div className="flex items-center justify-between text-sm">
                            <div>
                                <div className="font-medium">Напоминать про еду</div>
                                <div className="text-xs text-gray-500">
                                    Если давно не было записей.
                                </div>
                            </div>
                            <Toggle
                                checked={!!notif.foodEnabled}
                                onChange={(checked) =>
                                    setNotif((prev) => ({
                                        ...(prev || {}),
                                        foodEnabled: checked,
                                    }))
                                }
                            />
                        </div>

                        {notif.foodEnabled && (
                            <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>Через сколько часов напоминать</span>
                                <select
                                    className="border rounded-lg px-2 py-1 text-xs bg-white"
                                    value={notif.foodIntervalHours}
                                    onChange={(e) =>
                                        setNotif((prev) => ({
                                            ...(prev || {}),
                                            foodIntervalHours: Number(e.target.value) || 6,
                                        }))
                                    }
                                >
                                    <option value={3}>3 часа</option>
                                    <option value={4}>4 часа</option>
                                    <option value={6}>6 часов</option>
                                    <option value={8}>8 часов</option>
                                </select>
                            </div>
                        )}

                        <div className="pt-3 border-t border-gray-100 text-sm space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">
                                        Напоминать про симптомы
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Вечером напомним, если сегодня была еда,
                                        а симптомы ещё не отмечены.
                                    </div>
                                </div>
                                <Toggle
                                    checked={!!notif.symptomsEnabled}
                                    onChange={(checked) =>
                                        setNotif((prev) => ({
                                            ...(prev || {}),
                                            symptomsEnabled: checked,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}


function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            onClick={() => onChange && onChange(!checked)}
            className="relative inline-flex items-center select-none active:scale-95 transition"
        >
            <div className="relative w-[52px] h-[30px]">
                <div className="absolute inset-0 rounded-full border-[3px] border-black bg-white" />

                <div
                    className={
                        "absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-white border-[3px] border-black shadow-md transition-transform duration-200 " +
                        (checked ? "translate-x-[26px]" : "translate-x-[6px]")
                    }
                />
            </div>
        </button>
    );
}

function BigRadio({ label, value, checked, onChange }) {
    return (
        <label
            onClick={() => onChange(value)}
            className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white active:scale-[0.98] transition cursor-pointer"
        >
            <div
                className={
                    "w-5 h-5 rounded-full flex items-center justify-center border-2 transition " +
                    (checked
                        ? "border-blue-600"
                        : "border-gray-400")
                }
            >
                <div
                    className={
                        "w-3 h-3 rounded-full transition " +
                        (checked ? "bg-blue-600" : "bg-transparent")
                    }
                />
            </div>

            <span className="text-sm text-gray-700">{label}</span>
        </label>
    );
}