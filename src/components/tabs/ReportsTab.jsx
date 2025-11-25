import React from "react";
import { IconChevron } from "../../components/icons/Icons";

export default function ReportsTab({ ctx }) {
    const {
        daysWithSymptoms,
        daysWithoutSymptoms,
        expandedDays,
        toggleDayExpand,
        formatDate,
        fromKey,
        chipClass,
    } = ctx;

    return (
        <>
            <div className="p-4 space-y-6">
                {daysWithSymptoms.length === 0 && daysWithoutSymptoms.length === 0 && (
                    <div className="text-gray-400 text-sm rounded-2xl p-4 bg-white shadow-sm ring-1 ring-gray-100">
                        Ещё нету данных.
                    </div>
                )}

                {daysWithSymptoms.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold mb-2">Дни с аллергическими проявлениями</h3>
                        <ul className="space-y-2">
                            {daysWithSymptoms
                                .sort(([a], [b]) => (a < b ? 1 : -1))
                                .map(([k, d]) => {
                                    const opened = expandedDays.has(k);
                                    const foods = (d.foods && d.foods.length > 0)
                                        ? d.foods
                                        : [{ id: "none", name: "Без записей о еде" }];
                                    return (
                                        <li key={k} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                                            <button
                                                type="button"
                                                aria-expanded={opened}
                                                className={`w-full px-3 py-3 flex items-center justify-between transition
                                                                bg-white hover:bg-gray-50 active:bg-white
                                                                outline-none focus:outline-none touch-manipulation select-none
                                                                [-webkit-tap-highlight-color:transparent]`}
                                                onClick={() => toggleDayExpand(k)}
                                            >
                                                <div className="font-medium">{formatDate(fromKey(k))}</div>
                                                <span className={`transition-transform duration-300 ${opened ? "rotate-180" : ""}`}>
                                                    <IconChevron />
                                                </span>
                                            </button>

                                            <div className={`expand-panel ${opened ? "open" : ""}`}>
                                                <div className="px-3 pb-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        {foods.map((f) => (
                                                            <span
                                                                key={f.id || f.name}
                                                                className={`inline-flex items-center px-2.5 py-1.5 rounded-xl border text-[13px] shadow-sm ${chipClass(f.name)}`}
                                                            >
                                                                {f.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                        </ul>
                    </section>
                )}

                {daysWithoutSymptoms.length > 0 && (
                    <section>
                        <h3 className="text-sm font-semibold mb-2">Дни без аллергических проявлений</h3>
                        <ul className="space-y-2">
                            {daysWithoutSymptoms
                                .sort(([a], [b]) => (a < b ? 1 : -1))
                                .map(([k, d]) => {
                                    const opened = expandedDays.has(k);
                                    const foods = (d.foods && d.foods.length > 0)
                                        ? d.foods
                                        : [{ id: "none", name: "Без записей о еде" }];
                                    return (
                                        <li key={k} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                                            <button
                                                type="button"
                                                aria-expanded={opened}
                                                className={`w-full px-3 py-3 flex items-center justify-between transition
                                                                bg-white hover:bg-gray-50 active:bg-white
                                                                outline-none focus:outline-none touch-manipulation select-none
                                                                [-webkit-tap-highlight-color:transparent]`}
                                                onClick={() => toggleDayExpand(k)}
                                            >
                                                <div className="font-medium">{formatDate(fromKey(k))}</div>
                                                <span className={`transition-transform duration-300 ${opened ? "rotate-180" : ""}`}>
                                                    <IconChevron />
                                                </span>
                                            </button>

                                            <div className={`expand-panel ${opened ? "open" : ""}`}>
                                                <div className="px-3 pb-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        {foods.map((f) => (
                                                            <span
                                                                key={f.id || f.name}
                                                                className={`inline-flex items-center px-2.5 py-1.5 rounded-xl border text-[13px] shadow-sm ${chipClass(f.name)}`}
                                                            >
                                                                {f.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                        </ul>
                    </section>
                )}
            </div>
        </>
    );
}
