import React from "react";
import { IconTrash, IconChevron } from "../../components/icons/Icons";

export default function DiaryTab({ ctx }) {
    const {
        
        selectedDay, setSelectedDay, toKey, fromKey, todayDate, formatDate, ensureDay,
        
        productInput, setProductInput, showSuggestions, setShowSuggestions,
        highlightIndex, setHighlightIndex, filteredSuggestions, addFoodToSelected,
        current, deleteFood,
        
        SYMPTOMS_NONE, SYMPTOMS_YES, symptomsInput, setSymptomsInput, saveSymptoms,
        
        handleTouchStart, handleTouchMove, handleTouchEnd, daySwipeDir,
        
        setPlusOpen,
    } = ctx;

    const [saveAnim, setSaveAnim] = React.useState(false);

    return (
    <div
        className={`p-4 space-y-5 ${daySwipeDir === "left" ? "animate-swipe-left" :
            daySwipeDir === "right" ? "animate-swipe-right" : ""
            }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
        <section className="flex items-center gap-2">
            <input
                type="date"
                className="h-11 flex-1 border rounded-xl px-3 bg-gray-50"
                value={toKey(selectedDay)}
                onChange={(e) => {
                    const d = fromKey(e.target.value);
                    setSelectedDay(d);
                    ensureDay(d);
                }}
            />
            <button
                className="h-11 px-3 rounded-xl border bg-white hover:bg-gray-50"
                onClick={() => {
                    const d = todayDate();
                    setSelectedDay(d);
                    ensureDay(d);
                }}
            >
                Сегодня
            </button>
        </section>

        <section className="space-y-2">
            <label className="text-sm text-gray-600">Добавить продукт</label>
            <div className="relative flex items-stretch gap-2">
                <input
                    value={productInput}
                    onChange={(e) => {
                        setProductInput(e.target.value);
                        setShowSuggestions(true);
                        setHighlightIndex(0);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                    placeholder="Например: Молоко"
                    className="flex-1 min-w-0 border rounded-2xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition"
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setHighlightIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1));
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlightIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === "Enter" || e.key === "Tab") {
                            if (productInput.trim()) {
                                e.preventDefault();
                                addFoodToSelected(productInput, selectedDay);
                            }
                        } else if (e.key === "Escape") {
                            setShowSuggestions(false);
                        }
                    }}
                />
                    <button
                        className="flex-none px-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
                        disabled={!productInput.trim()}
                        onClick={() => addFoodToSelected(productInput, selectedDay)}
                    >
                        Добавить
                    </button>

                {showSuggestions && productInput.trim().length >= 1 && (
                    <div className="absolute left-0 right-0 top-[100%] max-w-full z-30 mt-1 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 max-h-60 overflow-auto">
                        {filteredSuggestions.map((opt, idx) => (
                            <button
                                key={opt + idx}
                                className={`w-full text-left px-3 py-2 ${idx === highlightIndex ? "bg-gray-100" : "bg-white"} hover:bg-gray-50 transition`}
                                onMouseEnter={() => setHighlightIndex(idx)}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    addFoodToSelected(opt, selectedDay);
                                }}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>

        <section className="space-y-2">
            <div className="text-sm text-gray-600">Еда за выбранный день</div>
            {current.foods.length === 0 ? (
                <div className="text-gray-400 text-sm rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100">
                    Пока пусто.
                </div>
            ) : (
                <ul className="space-y-2">
                    {current.foods.map((f) => (
                        <li
                            key={f.id}
                            className="flex items-center rounded-2xl p-3 bg-white shadow-sm ring-1 ring-gray-100"
                        >
                            <span className="font-medium flex-1 truncate">{f.name}</span>

                            <div className="ml-auto flex-shrink-0">
                                <button
                                    className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition"
                                    title="Удалить"
                                    onClick={() => deleteFood(f.id, selectedDay)}
                                >
                                    <IconTrash />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>

        <section className="space-y-2">
                <div className="text-sm text-gray-600">Симптомы за день</div>
                <div className="grid grid-cols-2 gap-2">

                    <button
                        type="button"
                        onClick={() => setSymptomsInput(SYMPTOMS_NONE)}
                        className={
                            "py-3 rounded-xl border text-sm font-medium select-none transition-all duration-200 ease-out " +
                            (symptomsInput === SYMPTOMS_NONE
                                ? "bg-emerald-100 border-emerald-400 text-emerald-700 shadow-sm"
                                : "bg-white border-gray-300 text-gray-700")
                        }
                    >
                        {SYMPTOMS_NONE}
                    </button>

                    <button
                        type="button"
                        onClick={() => setSymptomsInput(SYMPTOMS_YES)}
                        className={
                            "py-3 rounded-xl border text-sm font-medium select-none transition-all duration-200 ease-out " +
                            (symptomsInput === SYMPTOMS_YES
                                ? "bg-rose-100 border-rose-400 text-rose-700 shadow-sm"
                                : "bg-white border-gray-300 text-gray-700")
                        }
                    >
                        {SYMPTOMS_YES}
                    </button>

                </div>
                <button
                    onClick={() => {
                        saveSymptoms();
                        setSaveAnim(true);
                        setTimeout(() => setSaveAnim(false), 180);
                    }}
                    className={
                        "w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm transition-transform duration-150 " +
                        (saveAnim ? "scale-95" : "")
                    }
                >
                    Сохранить симптомы
                </button>
        </section>
    </div>
    );
}
