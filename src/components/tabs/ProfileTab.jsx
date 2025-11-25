import React, { useMemo, useRef } from "react";
import jsPDF from "jspdf";


let pdfFontLoaded = false;

async function applyPdfFont(doc) {
    if (pdfFontLoaded) {
        doc.setFont("TimesNewRoman", "normal");
        return;
    }

    
    const regularUrl = "/fonts/times-new-roman.ttf";
    const boldUrl = "/fonts/times-new-roman-bold.ttf";

    async function loadFont(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Font load error: " + url);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    const regularB64 = await loadFont(regularUrl);
    const boldB64 = await loadFont(boldUrl);

    
    doc.addFileToVFS("times-new-roman.ttf", regularB64);
    doc.addFont("times-new-roman.ttf", "TimesNewRoman", "normal");

    
    doc.addFileToVFS("times-new-roman-bold.ttf", boldB64);
    doc.addFont("times-new-roman-bold.ttf", "TimesNewRoman", "bold");

    doc.setFont("TimesNewRoman", "normal");

    pdfFontLoaded = true;
}



export default function ProfileTab({ ctx }) {
    const {
        usageDays,
        entries,
        userEmail,
        sendPasswordResetEmail,
        setToastMsg,
        signOutUser,
        setEntries, 
    } = ctx;

    
    const totalProducts = useMemo(() => {
        if (!entries) return 0;
        let sum = 0;
        for (const key of Object.keys(entries)) {
            const day = entries[key];
            if (day && Array.isArray(day.foods)) {
                sum += day.foods.length;
            }
        }
        return sum;
    }, [entries]);

    
    const usageDaysCount = useMemo(() => {
        if (Array.isArray(usageDays)) return usageDays.length;
        if (typeof usageDays === "number") return usageDays;
        return 0;
    }, [usageDays]);

    const fileInputRef = useRef(null);
    const [showClearConfirm, setShowClearConfirm] = React.useState(false);
    const [policyOpen, setPolicyOpen] = React.useState(false); 
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
    const [reportAnim, setReportAnim] = React.useState(false);


    const handleClearDiary = () => {
        try {
            setEntries({});
            notify("Дневник очищен.");
        } catch (e) {
            console.error(e);
            notify("Не удалось очистить дневник.");
        }
        setShowClearConfirm(false);
    };

    const notify = (msg) => {
        if (typeof setToastMsg === "function") {
            setToastMsg(msg);
            setTimeout(() => setToastMsg(""), 1500);
        } else {
            alert(msg);
        }
    };

    
    const handleExport = () => {
        try {
            const data = JSON.stringify(entries || {}, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "food-diary-export.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            notify("Дневник сохранён в файл.");
        } catch (e) {
            console.error(e);
            notify("Не удалось экспортировать дневник.");
        }
    };

    
    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleImportFileChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = String(ev.target?.result || "");
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== "object") {
                    throw new Error("Формат файла не распознан");
                }

                if (typeof setEntries !== "function") {
                    notify("Импорт пока не настроен (нет setEntries в контексте).");
                    return;
                }

                if (
                    !window.confirm(
                        "Импорт заменит текущий дневник данными из файла. Продолжить?"
                    )
                ) {
                    return;
                }

                setEntries(parsed);
                notify("Дневник импортирован.");
            } catch (err) {
                console.error(err);
                notify("Не удалось импортировать файл дневника.");
            }
        };
        reader.onerror = () => {
            notify("Ошибка чтения файла.");
        };
        reader.readAsText(file, "utf-8");
    };

    
    const handleResetPassword = async () => {
        if (!userEmail) {
            notify("Email пользователя не найден.");
            return;
        }
        try {
            await sendPasswordResetEmail(userEmail);
            notify("Письмо для смены пароля отправлено на email.");
        } catch (e) {
            console.error(e);
            notify("Не удалось отправить письмо для смены пароля.");
        }
    };

    
    function formatDateRu(dateStr) {
        const [y, m, d] = dateStr.split("-");
        return `${d}.${m}.${y}`;
    }

    
    function addPageIfNeeded(doc, currentY, neededSpace = 10) {
        const pageHeight = doc.internal.pageSize.getHeight();
        const bottomMargin = 20;

        if (currentY + neededSpace > pageHeight - bottomMargin) {
            doc.addPage();
            doc.setFont("TimesNewRoman", "normal");  
            doc.setFontSize(10);                    
            return 20;
        }

        return currentY;
    }

    
    
    const handleMonthlyReport = async () => {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); 
            const monthStr = String(month + 1).padStart(2, "0");
            const prefix = `${year}-${monthStr}-`;

            const monthNames = [
                "январь",
                "февраль",
                "март",
                "апрель",
                "май",
                "июнь",
                "июль",
                "август",
                "сентябрь",
                "октябрь",
                "ноябрь",
                "декабрь",
            ];
            const title = `Отчёт за ${monthNames[month]} ${year} года`;

            const keys = Object.keys(entries || {}).filter((k) =>
                k.startsWith(prefix)
            );

            if (!keys.length) {
                notify("За этот месяц пока нет записей.");
                return;
            }

            keys.sort();

            
            const daysData = keys.map((k) => {
                const day = entries[k] || {};
                const foods = Array.isArray(day.foods) ? day.foods : [];
                const symptoms = (day.symptoms || "").trim();
                const hasSymptoms = !!symptoms && symptoms !== "Нет высыпаний";
                return {
                    key: k,
                    foods,
                    symptoms,
                    hasSymptoms,
                };
            });

            
            const productStats = {};
            for (const d of daysData) {
                if (!d.hasSymptoms) continue;
                for (const f of d.foods) {
                    const name = (f && f.name) || "";
                    if (!name) continue;
                    productStats[name] = (productStats[name] || 0) + 1;
                }
            }
            const suspiciousProducts = Object.entries(productStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10); 

            
            const daysWithSymptoms = daysData.filter((d) => d.hasSymptoms).length;
            const totalFoodsMonth = daysData.reduce(
                (sum, d) => sum + d.foods.length,
                0
            );

            
            const doc = new jsPDF();
            try {
                await applyPdfFont(doc);
            } catch (fontErr) {
                console.error("Не удалось загрузить шрифт для PDF:", fontErr);
            }

            const pageWidth = doc.internal.pageSize.getWidth();
            const leftMargin = 16;
            const rightMargin = 16;
            const contentWidth = pageWidth - leftMargin - rightMargin;

            let y = 20;

            
            const drawSectionTitle = (text) => {
                y = addPageIfNeeded(doc, y, 10);
                doc.setFontSize(12);
                doc.setTextColor(40, 40, 40);
                doc.text(text, leftMargin, y);
                doc.setDrawColor(220);
                doc.setLineWidth(0.3);
                doc.line(leftMargin, y + 2, leftMargin + contentWidth, y + 2);
                y += 8;
            };

            
            doc.setFontSize(16);
            doc.setTextColor(33, 33, 33);
            doc.text(title, pageWidth / 2, y, { align: "center" });
            y += 8;

            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            const createdAt = now.toLocaleDateString("ru-RU");
            doc.text(
                `Отчёт сформирован: ${createdAt}`,
                pageWidth / 2,
                y,
                { align: "center" }
            );
            y += 10;

            
            const summaryHeight = 20;
            y = addPageIfNeeded(doc, y, summaryHeight + 4);

            doc.setFillColor(247, 249, 252);
            doc.setDrawColor(230, 230, 230);
            doc.roundedRect(
                leftMargin,
                y,
                contentWidth,
                summaryHeight,
                2,
                2,
                "FD"
            );

            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);

            const col1X = leftMargin + 4;
            const col2X = leftMargin + contentWidth / 2;

            doc.text(`Дней в отчёте: ${daysData.length}`, col1X, y + 7);
            doc.text(`С симптомами: ${daysWithSymptoms}`, col1X, y + 13);

            doc.text(`Всего продуктов: ${totalFoodsMonth}`, col2X, y + 7);
            doc.text(
                `Пользователь: ${userEmail || "-"}`,
                col2X,
                y + 13
            );

            y += summaryHeight + 10;

            
            drawSectionTitle("Симптомы по дням месяца");

            const chartHeight = 30;
            const chartTop = y + 2;
            const chartBottom = chartTop + chartHeight;

            const barCount = daysData.length;
            const barWidth = Math.max(2, contentWidth / barCount);

            
            doc.setDrawColor(220);
            doc.line(leftMargin, chartBottom, leftMargin + contentWidth, chartBottom);

            
            daysData.forEach((d, idx) => {
                const x = leftMargin + idx * barWidth;
                const hasSym = d.hasSymptoms;

                if (hasSym) {
                    doc.setFillColor(239, 68, 68); 
                } else {
                    doc.setFillColor(209, 213, 219); 
                }

                const barH = hasSym ? chartHeight : chartHeight * 0.35;
                const yTop = chartBottom - barH;

                doc.rect(x + 0.5, yTop, barWidth - 1, barH, "F");

                
                const dayNumber = Number(d.key.slice(-2)); 
                if (barCount <= 31 && (idx % 5 === 0 || barWidth > 6)) {
                    doc.setFontSize(7);
                    doc.setTextColor(90);
                    doc.text(
                        String(dayNumber),
                        x + barWidth / 2,
                        chartBottom + 4,
                        { align: "center" }
                    );
                }
            });

            y = chartBottom + 10;
            doc.setFontSize(8);
            doc.setTextColor(90);
            doc.text(
                "Красные столбики — дни с симптомами, серые — дни без симптомов.",
                leftMargin,
                y
            );
            y += 10;

            
            drawSectionTitle("Подозрительные продукты");

            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);

            if (!suspiciousProducts.length) {
                y = addPageIfNeeded(doc, y, 8);
                doc.text(
                    "Пока недостаточно данных, чтобы выделить конкретные продукты.",
                    leftMargin,
                    y
                );
                y += 8;
            } else {
                suspiciousProducts.forEach(([name, count], idx) => {
                    y = addPageIfNeeded(doc, y, 6);
                    const line = `${idx + 1}. ${name} — ${count} раз в дни с симптомами`;
                    doc.text(line, leftMargin, y);
                    y += 6;
                });
            }

            
            drawSectionTitle("Симптомы и заметки по дням");

            doc.setFontSize(9);
            doc.setTextColor(55, 55, 55);

            daysData.forEach((d) => {
                if (!d.symptoms) return;
                y = addPageIfNeeded(doc, y, 6);
                const line = `${formatDateRu(d.key)}: ${d.symptoms}`;
                doc.text(line, leftMargin, y);
                y += 5;
            });

            const fileName = `food-diary-report-${year}-${monthStr}.pdf`;
            doc.save(fileName);
            notify("PDF-отчёт за месяц сформирован.");
        } catch (e) {
            console.error(e);
            notify("Не удалось сформировать отчёт.");
        }
    };

    return (
        <>
            <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col justify-between">
                        <div className="text-xs text-gray-500">Дни использования</div>
                        <div className="mt-1 text-2xl font-semibold">
                            {usageDaysCount}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col justify-between">
                        <div className="text-xs text-gray-500">
                            Продуктов употреблено
                        </div>
                        <div className="mt-1 text-2xl font-semibold">
                            {totalProducts}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-3 space-y-3">
                    <div className="text-sm font-semibold text-gray-700">Аккаунт</div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="text-basetext-gray-700 break-all">
                            {userEmail || "Email не найден"}
                        </div>

                        <button
                            type="button"
                            onClick={handleResetPassword}
                            className="px-3 py-2 rounded-xl bg-blue-600/20 text-blue-700 text-xs font-semibold hover:bg-blue-600/30 active:scale-[0.97] transition"
                        >
                            Сменить пароль
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handleExport}
                        className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col items-center justify-center active:scale-[0.98] transition"
                    >
                        <img src="/icons/export.png" alt="export" className="w-8 h-8" />
                        <div className="text-sm font-medium text-gray-700 text-center">
                            Экспорт дневника
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleImportClick}
                        className="rounded-2xl border border-gray-200 bg-white p-3 flex flex-col items-center justify-center active:scale-[0.98] transition"
                    >
                        <img src="/icons/import.png" alt="import" className="w-8 h-8" />
                        <div className="text-sm font-medium text-gray-700 text-center">
                            Импорт дневника
                        </div>
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleImportFileChange}
                />

                <button
                    type="button"
                    onClick={() => {
                        handleMonthlyReport();
                        setReportAnim(true);
                        setTimeout(() => setReportAnim(false), 180);
                    }}
                    className={
                        "w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm transition-transform duration-150 " +
                        (reportAnim ? "scale-95" : "")
                    }
                >
                    Сформировать отчёт за месяц
                </button>

                <button
                    type="button"
                    onClick={() => ctx.clearAllData()}
                    className="w-full py-3 text-sm rounded-xl bg-white text-red-600 font-semibold border border-gray-300 transition"
                >
                    Очистить дневник
                </button>

                <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="w-full py-3 text-sm rounded-xl bg-white text-red-600 font-semibold border border-gray-300 transition"
                >
                    Выйти
                </button>

                <div className="mt-2 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-600 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-gray-800">
                                Политика использования
                            </div>
                            <p className="mt-1">
                                Приложение помогает отслеживать продукты и реакции, но не
                                заменяет врача. Отчёты и подсказки носят ориентировочный
                                характер.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPolicyOpen(true)}
                            className="shrink-0 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 active:scale-[0.97] transition"
                        >
                            Подробнее
                        </button>
                    </div>
                </div>
            </div>

            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
                    <div className="bg-white w-[85%] max-w-[360px] rounded-2xl p-5 space-y-4 shadow-xl">
                        <div className="text-lg font-semibold text-gray-800 text-center">
                            Очистить дневник?
                        </div>
                        <div className="text-sm text-gray-600 text-center">
                            Это удалит <strong>все данные</strong> без возможности
                            восстановления. Вы уверены?
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium transition"
                                onClick={() => setShowClearConfirm(false)}
                            >
                                Отмена
                            </button>
                            <button
                                className="flex-1 py-2 rounded-xl bg-red-600 text-white font-medium transition"
                                onClick={handleClearDiary}
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
                    <div className="bg-white w-[85%] max-w-[360px] rounded-2xl p-5 space-y-4 shadow-xl">
                        <div className="text-lg font-semibold text-gray-800 text-center">
                            Выйти из аккаунта?
                        </div>
                        <div className="text-sm text-gray-600 text-center">
                            Вы сможете снова войти позже, используя свою почту.
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium transition"
                                onClick={() => setShowLogoutConfirm(false)}
                            >
                                Отмена
                            </button>
                            <button
                                className="flex-1 py-2 rounded-xl bg-red-600 text-white font-medium transition"
                                onClick={() => {
                                    signOutUser();
                                    setShowLogoutConfirm(false);
                                }}
                            >
                                Выйти
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {policyOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
                    <div className="bg-white w-[90%] max-w-[420px] max-h-[80vh] rounded-2xl p-5 shadow-xl flex flex-col">
                        <div className="relative mb-3 text-center">
                            <h2 className="text-base font-semibold text-gray-900">
                                Политика использования
                            </h2>
                            <button
                                type="button"
                                onClick={() => setPolicyOpen(false)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-100 active:scale-95 transition"
                                aria-label="Назад"
                            >
                                <span className="text-3xl leading-none">‹</span>
                            </button>

                        </div>
                        <div className="text-[13px] text-gray-700 space-y-3 overflow-y-auto">
                            <p>
                                Приложение «Пищевой дневник» предназначено для личного
                                ведения записей о приёмах пищи, симптомах и возможных
                                реакциях организма. Оно не является медицинским изделием и
                                не заменяет консультацию врача.
                            </p>
                            <p>
                                Вся информация, отчёты и подсказки, которые вы видите в
                                приложении, носят ориентировочный характер и не являются
                                диагнозом, рекомендацией по лечению или назначением
                                лекарственных препаратов.
                            </p>
                            <p>
                                Любые решения, связанные со здоровьем (приём лекарств,
                                ограничения в питании, изменение схем лечения и т.п.), вы
                                принимаете самостоятельно и под свою ответственность. При
                                подозрении на аллергию, непереносимость продуктов или иные
                                проблемы со здоровьем обязательно обращайтесь к врачу.
                            </p>
                            <p>
                                Ваши записи о еде и симптомах используются только для работы
                                дневника: отображения истории, анализа и формирования
                                отчётов внутри приложения. Вы можете экспортировать и
                                удалить дневник через соответствующие функции.
                            </p>
                            <p className="text-[11px] text-gray-500">
                                Этот текст носит примерный характер и не является
                                юридической консультацией.
                            </p>
                            <div className="mt-6 mb-2 text-center text-[11px] text-gray-400">
                                © {new Date().getFullYear()} Food Diary. Все права защищены.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}