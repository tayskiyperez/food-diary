import React from "react";
import { Html5Qrcode } from "html5-qrcode";
import { IconTrash } from "./icons/Icons";

export default function AddProductModal({ ctx }) {
    const {
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
    } = ctx;

    const [isScanning, setIsScanning] = React.useState(false);
    const [scannerOpen, setScannerOpen] = React.useState(false);
    const scannerRef = React.useRef(null);
    const html5QrcodeRef = React.useRef(null);
    const scannerStartedRef = React.useRef(false);

    
    const [customPanelOpen, setCustomPanelOpen] = React.useState(false);
    const [customMode, setCustomMode] = React.useState(null); 
    const [singleName, setSingleName] = React.useState("");
    const [recipeName, setRecipeName] = React.useState("");
    const [ingredients, setIngredients] = React.useState([""]);

    const [lastSavedName, setLastSavedName] = React.useState("");
    const [showSavedToast, setShowSavedToast] = React.useState(false);

    const showSaved = (name) => {
        setLastSavedName(name);
        setShowSavedToast(true);
        setTimeout(() => {
            setShowSavedToast(false);
        }, 1500);
    };

    const makeId = () =>
        (typeof crypto !== "undefined" &&
            crypto.randomUUID &&
            crypto.randomUUID()) ||
        Math.random().toString(36).slice(2);

    const resetCustomForm = () => {
        setCustomMode(null);
        setSingleName("");
        setRecipeName("");
        setIngredients([""]);
    };

    const handleSaveSingle = () => {
        const name = singleName.trim();
        if (!name || !setCustomFoods) return;

        setCustomFoods((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            return [
                ...base,
                {
                    id: makeId(),
                    name,
                    ingredients: null,
                },
            ];
        });

        resetCustomForm();
        setCustomPanelOpen(false);
        showSaved(name);
    };

    const handleSaveComposite = () => {
        const name = recipeName.trim();
        if (!name || !setCustomFoods) return;

        const ingList = ingredients
            .map((s) => s.trim())
            .filter(Boolean);

        if (!ingList.length) return;

        setCustomFoods((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            return [
                ...base,
                {
                    id: makeId(),
                    name,
                    ingredients: ingList,
                },
            ];
        });

        resetCustomForm();
        setCustomPanelOpen(false);
        showSaved(name);
    };

    const handleDeleteCustomFood = (id) => {
        if (!setCustomFoods) return;

        setCustomFoods((prev) => {
            if (!Array.isArray(prev)) return [];
            return prev.filter((item) => item.id !== id);
        });
    };

    const handleIngredientChange = (index, value) => {
        setIngredients((prev) =>
            prev.map((v, i) => (i === index ? value : v))
        );
    };

    const handleAddIngredientRow = () => {
        setIngredients((prev) => [...prev, ""]);
    };

    const handleRemoveIngredientRow = (index) => {
        setIngredients((prev) => prev.filter((_, i) => i !== index));
    };

    const cleanupScanner = React.useCallback(() => {
        const instance = html5QrcodeRef.current;

        if (!instance) {
            scannerStartedRef.current = false;
            return;
        }

        
        
        html5QrcodeRef.current = null;

        try {
            if (scannerStartedRef.current && typeof instance.stop === "function") {
                instance
                    .stop()
                    .then(() => {
                        try {
                            if (typeof instance.clear === "function") {
                                instance.clear();
                            }
                        } catch (e) {
                            console.warn("Html5Qrcode clear() error:", e);
                        } finally {
                            scannerStartedRef.current = false;
                        }
                    })
                    .catch((e) => {
                        console.warn("Html5Qrcode stop() error:", e);
                        scannerStartedRef.current = false;
                    });
            } else {
                
                
                scannerStartedRef.current = false;
            }
        } catch (e) {
            console.error("cleanupScanner fatal error:", e);
            scannerStartedRef.current = false;
        }
    }, []);

    
    React.useEffect(() => {
        if (!scannerOpen) {
            cleanupScanner();
            return;
        }

        return () => {
            cleanupScanner();
        };
    }, [scannerOpen, cleanupScanner]);

    if (!plusOpen) return null;

    const handleScanBarcode = () => {
        setScannerOpen(true);

        setTimeout(async () => {
            if (!scannerRef.current) return;
            try {
                const devices = await Html5Qrcode.getCameras();

                let cameraId = { facingMode: "environment" };
                if (devices && devices.length) {
                    const backCam = devices.find((d) =>
                        d.label.toLowerCase().includes("back") ||
                        d.label.toLowerCase().includes("rear")
                    );
                    cameraId = backCam ? backCam.id : devices[0].id;
                }

                const html5Qr = new Html5Qrcode(scannerRef.current.id);
                html5QrcodeRef.current = html5Qr;
                scannerStartedRef.current = false;

                let handled = false;

                const config = {
                    fps: 20,
                    qrbox: { width: 340, height: 200 },
                };

                await html5Qr.start(
                    cameraId,
                    config,
                    async (decodedText) => {
                        console.log("DECODED:", decodedText);

                        if (!decodedText || handled) return;
                        handled = true;

                        setIsScanning(true);

                        try {
                            const response = await fetch(
                                `https:
                                    decodedText
                                )}.json`
                            );

                            const data = await response.json();

                            const name =
                                data &&
                                data.status === 1 &&
                                data.product &&
                                (data.product.product_name_ru ||
                                    data.product.product_name ||
                                    "");

                            if (data.status !== 1 || !data.product) {
                                alert(
                                    "Товар не найден в базе. Введите название вручную 🙂"
                                );
                                return;
                            }

                            if (!name) {
                                alert(
                                    "Для этого товара не найдено название. Введите название вручную."
                                );
                                return;
                            }

                            setProductInput(name);
                            setShowSuggestions(true);
                            setHighlightIndex(0);
                            setScannerOpen(false);
                        } catch (error) {
                            console.error(error);
                            alert("Ошибка связи с базой OpenFoodFacts.");
                        } finally {
                            setIsScanning(false);
                        }
                    },
                    () => { }
                );

                scannerStartedRef.current = true;
            } catch (err) {
                console.error("Ошибка при запуске камеры:", err);
                scannerStartedRef.current = false;

                if (err && err.name === "NotAllowedError") {
                    alert(
                        "Камера недоступна.\n\n" +
                        "Похоже, доступ к камере для этого приложения запрещён.\n" +
                        "Откройте настройки телефона → Приложения → «Пищевой дневник» → Разрешения и включите доступ к камере."
                    );
                } else if (err && err.name === "NotFoundError") {
                    alert(
                        "Камера не найдена на устройстве или недоступна. " +
                        "Попробуйте перезапустить устройство или использовать другое."
                    );
                } else {
                    alert(
                        "Не удалось открыть камеру.\n\n" +
                        "Попробуйте:\n" +
                        "• закрыть и заново открыть приложение;\n" +
                        "• перезагрузить устройство;\n" +
                        "• проверить, что в настройках приложения разрешён доступ к камере."
                    );
                }

                cleanupScanner();
            }
        }, 0);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-4 relative">
                <div className="text-lg font-semibold mb-2 text-center">
                    Добавить продукт
                </div>

                {showSavedToast && (
                    <div className="mb-2 rounded-xl bg-green-50 text-green-700 text-xs px-3 py-2 text-center animate-fade-in">
                        Блюдо «{lastSavedName}» сохранено
                    </div>
                )}

                <div className="relative flex items-stretch gap-2">
                    <input
                        value={productInput}
                        onChange={(e) => {
                            setProductInput(e.target.value);
                            setShowSuggestions(true);
                            setHighlightIndex(0);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder="Например: Молоко"
                        className="flex-1 min-w-0 border rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                    />
                    <button
                        className="flex-none px-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
                        disabled={!productInput.trim()}
                        onClick={() => {
                            addFoodToSelected(productInput, selectedDay);
                            setPlusOpen(false);
                        }}
                    >
                        Добавить
                    </button>

                    {showSuggestions && productInput.trim().length >= 1 && (
                        <div className="absolute left-0 right-0 top-[100%] max-w-full z-50 mt-1 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 max-h-60 overflow-auto">
                            {top5Suggestions(dict, productInput).map(
                                (opt, idx) => (
                                    <button
                                        key={opt + idx}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            addFoodToSelected(opt, selectedDay);
                                            setPlusOpen(false);
                                        }}
                                    >
                                        {opt}
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setCustomPanelOpen((v) => !v);
                        if (!customPanelOpen) {
                            resetCustomForm();
                        }
                    }}
                    className="mt-4 w-full flex items-center gap-2 px-3 py-2 rounded-2xl bg-blue-50/70 text-blue-600 text-sm font-medium active:scale-[0.97] transition"
                >
                    <img
                        src="/icons/plus.png"
                        alt=""
                        className="w-4 h-4 object-contain"
                    />
                    <span>Добавить блюдо</span>
                </button>

                <div
                    className={`overflow-hidden transition-all duration-300 ${customPanelOpen
                            ? "max-h-[480px] opacity-100 translate-y-0 mt-2"
                            : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
                        }`}
                >
                    <div className="rounded-2xl border border-gray-100 bg-white/90 p-3 space-y-3">
                        <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="text-gray-500">Тип:</span>
                            <button
                                type="button"
                                onClick={() => setCustomMode("single")}
                                className={`px-3 py-1 rounded-full border text-xs ${customMode === "single"
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-gray-50 text-gray-700 border-gray-200"
                                    }`}
                            >
                                Одиночное
                            </button>
                            <button
                                type="button"
                                onClick={() => setCustomMode("composite")}
                                className={`px-3 py-1 rounded-full border text-xs ${customMode === "composite"
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-gray-50 text-gray-700 border-gray-200"
                                    }`}
                            >
                                Составное
                            </button>
                        </div>

                        {customMode === null && (
                            <p className="text-xs text-gray-400">
                                Выберите, хотите сохранить одно блюдо или блюдо
                                с ингредиентами.
                            </p>
                        )}

                        {customMode === "single" && (
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-2">
                                <img
                                    src="/icons/plus.png"
                                    alt=""
                                    className="w-4 h-4 object-contain"
                                />
                                <input
                                    value={singleName}
                                    onChange={(e) =>
                                        setSingleName(e.target.value)
                                    }
                                    placeholder="Название блюда"
                                    className="flex-1 bg-white border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveSingle}
                                    disabled={!singleName.trim()}
                                    className="text-xs font-semibold text-blue-600 disabled:opacity-40"
                                >
                                    Сохранить
                                </button>
                            </div>
                        )}

                        {customMode === "composite" && (
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-2">
                                    <span className="text-gray-500 text-xs whitespace-nowrap">
                                        Блюдо
                                    </span>
                                    <input
                                        value={recipeName}
                                        onChange={(e) =>
                                            setRecipeName(e.target.value)
                                        }
                                        placeholder="Например: Салат Цезарь"
                                        className="flex-1 bg-white border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                                    />
                                </div>

                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {ingredients.map((val, idx) => (
                                        <div
                                            key={idx}
                                            className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-2"
                                        >
                                            <img
                                                src="/icons/plus.png"
                                                alt=""
                                                className="w-4 h-4 object-contain"
                                            />
                                            <input
                                                value={val}
                                                onChange={(e) =>
                                                    handleIngredientChange(
                                                        idx,
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Ингредиент"
                                                className="flex-1 bg-white border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                                            />
                                            {ingredients.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRemoveIngredientRow(
                                                            idx
                                                        )
                                                    }
                                                    className="text-gray-400 text-lg px-1"
                                                    aria-label="Удалить ингредиент"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddIngredientRow}
                                    className="flex items-center gap-1 text-xs text-blue-600"
                                >
                                    <img
                                        src="/icons/plus.png"
                                        alt=""
                                        className="w-4 h-4 object-contain"
                                    />
                                    <span>Добавить ингредиент</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveComposite}
                                    disabled={
                                        !recipeName.trim() ||
                                        !ingredients.some((v) => v.trim())
                                    }
                                    className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 active:scale-[0.97] transition"
                                >
                                    Сохранить блюдо
                                </button>
                            </div>
                        )}

                        <div className="pt-2 border-t border-gray-100 mt-1">
                            <div className="text-xs font-semibold text-gray-500 mb-1">
                                Мои блюда
                            </div>

                            {Array.isArray(customFoods) && customFoods.length > 0 ? (
                                <div className="space-y-2 max-h-36 overflow-y-auto">
                                    {customFoods.map((item) => (
                                        <div
                                            key={item.id}
                                            className="w-full rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition flex items-center gap-2 px-3 py-2"
                                        >
                                            <button
                                                type="button"
                                                className="flex-1 text-left flex flex-col"
                                                onClick={() => {
                                                    addFoodToSelected(item.name, selectedDay);
                                                    setPlusOpen(false);
                                                }}
                                            >
                                                <div className="text-sm font-medium text-gray-900">
                                                    {item.name}
                                                </div>
                                                {Array.isArray(item.ingredients) &&
                                                    item.ingredients.length > 0 && (
                                                        <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                                                            {item.ingredients.join(", ")}
                                                        </div>
                                                    )}
                                            </button>

                                            <button
                                                type="button"
                                                className="ml-1 p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition flex-shrink-0"
                                                title="Удалить блюдо"
                                                onClick={(e) => {
                                                    e.stopPropagation();        
                                                    handleDeleteCustomFood(item.id);
                                                }}
                                            >
                                                <IconTrash />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400">
                                    Здесь будут ваши сохранённые блюда. Добавьте одно выше.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleScanBarcode}
                    disabled={isScanning}
                    className="w-full mt-3 py-3 rounded-xl border border-blue-200 text-black font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition disabled:opacity-60"
                >
                    <img
                        src="/icons/scanner.png"
                        alt=""
                        className="w-5 h-5 object-contain"
                    />
                    <span>
                        {isScanning
                            ? "Ищем продукт..."
                            : "Сканировать штрих-код"}
                    </span>
                </button>

                <button
                    className="w-full mt-3 py-3 rounded-xl border bg-white hover:bg-gray-50"
                    onClick={() => setPlusOpen(false)}
                >
                    Отмена
                </button>

                {scannerOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-[420px] p-4">
                            <header className="relative flex items-center justify-center mb-3">
                                <button
                                    type="button"
                                    onClick={() => setScannerOpen(false)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-100 active:scale-95 transition"
                                    aria-label="Закрыть сканер"
                                >
                                    <span className="text-2xl leading-none">
                                        ‹
                                    </span>
                                </button>

                                <h2 className="text-base font-semibold text-gray-900">
                                    Сканирование штрих-кода
                                </h2>
                            </header>

                            <div
                                id="barcode-scanner"
                                ref={scannerRef}
                                className="w-full aspect-[3/2] bg-black rounded-xl overflow-hidden"
                            />
                            <p className="mt-3 text-xs text-gray-500 text-center">
                                Наведите камеру на штрих-код товара.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}