window.DeliveryBook = window.DeliveryBook || {};

/* ======================================================
   월별 기록 뷰

   - 1일부터 말일까지 쭉 나열
   - 입력된 날: 수입/실수령 표시
   - 빈 날: "미입력" — 탭하면 그 날짜 입력폼으로 이동
   - 상단에 월 요약 카드
   ====================================================== */

DeliveryBook.MonthView = (() => {
    const Calc = DeliveryBook.Calc;
    const Data = DeliveryBook.Data;

    /* 보고 있는 연·월 */
    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();

    function setMonth(year, month) {
        viewYear = year;
        viewMonth = month;
    }

    function moveMonth(offset) {
        const d = new Date(viewYear, viewMonth + offset, 1);

        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
    }

    /* ==================================================
       렌더링
       ================================================== */

    function render(container) {
        const state = Data.getState();
        const taxRate = Data.getTaxRate();
        const total = Calc.month(
            state.entries, viewYear, viewMonth, taxRate
        );

        const lastDay = new Date(viewYear, viewMonth + 1, 0)
            .getDate();

        const todayKey = Calc.dateKey(new Date());

        let rows = "";

        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(viewYear, viewMonth, d);
            const key = Calc.dateKey(date);
            const entry = state.entries[key];
            const result = Calc.day(entry, taxRate);

            const weekday = Calc.weekdayName(date);
            const dayOfWeek = date.getDay();
            const wClass =
                dayOfWeek === 0
                    ? "sun"
                    : dayOfWeek === 6
                      ? "sat"
                      : "";

            const rowClass =
                "day-row" +
                (key === todayKey ? " today" : "") +
                (!result ? " empty" : "");

            const incomeCell = result
                ? incomeSummary(entry)
                : "아직 기록이 없습니다";

            const netCell = result
                ? '<span class="net-cell">' +
                  Calc.fmt(result.net) + "원</span>"
                : '<span class="net-cell missing">+ 입력</span>';

            const netCellWrapped = result && result.net < 0
                ? '<span class="net-cell negative">' +
                  Calc.fmt(result.net) + "원</span>"
                : netCell;

            rows +=
                '<div class="' + rowClass + '" data-date="' + key + '">' +
                    '<div class="date-cell">' +
                        '<span class="d">' + d + "일</span>" +
                        '<span class="w ' + wClass + '">' +
                            weekday +
                        '</span>' +
                    '</div>' +
                    '<div class="income-cell">' + incomeCell + '</div>' +
                    netCellWrapped +
                '</div>';
        }

        container.innerHTML =
            '<section class="panel">' +
                '<div class="month-nav">' +
                    '<button type="button" class="day-nav-btn" ' +
                        'id="prev-month" aria-label="이전 달">◀</button>' +
                    '<div class="month-title">' +
                        viewYear + "년 " + (viewMonth + 1) + "월" +
                    '</div>' +
                    '<button type="button" class="day-nav-btn" ' +
                        'id="next-month" aria-label="다음 달">▶</button>' +
                '</div>' +

                '<div class="summary-grid">' +
                    '<div class="summary-card income">' +
                        '<span class="label">총 수입</span>' +
                        '<span class="amount">' +
                            Calc.fmt(total.income) + "원" +
                        '</span>' +
                    '</div>' +
                    '<div class="summary-card tax">' +
                        '<span class="label">예상 세금</span>' +
                        '<span class="amount">' +
                            Calc.fmt(total.tax) + "원" +
                        '</span>' +
                    '</div>' +
                    '<div class="summary-card expense">' +
                        '<span class="label">총 지출</span>' +
                        '<span class="amount">' +
                            Calc.fmt(total.expense) + "원" +
                        '</span>' +
                    '</div>' +
                    '<div class="summary-card net">' +
                        '<span class="label">' +
                            (viewMonth + 1) + "월 순수령 (기록 " +
                            total.days + "일)" +
                        '</span>' +
                        '<span class="amount">' +
                            Calc.fmt(total.net) + "원" +
                        '</span>' +
                    '</div>' +
                '</div>' +

                '<div class="day-list">' + rows + '</div>' +
            '</section>';

        bindEvents(container);
    }

    /* "배민 33,000 · 쿠팡 12,000 · 지출 5,000" 요약 */
    function incomeSummary(entry) {
        const parts = [];

        if (entry.baemin) {
            parts.push("배민 " + Calc.fmt(entry.baemin));
        }

        if (entry.coupang) {
            parts.push("쿠팡 " + Calc.fmt(entry.coupang));
        }

        const expense =
            (Number(entry.fuel) || 0) +
            (Number(entry.repair) || 0) +
            (Number(entry.other) || 0);

        if (expense > 0) {
            parts.push("지출 " + Calc.fmt(expense));
        }

        if (entry.note) {
            parts.push("📝 " + entry.note);
        }

        return '<span class="nums">' + parts.join(" · ") + '</span>';
    }

    /* ==================================================
       이벤트
       ================================================== */

    function bindEvents(container) {
        container
            .querySelector("#prev-month")
            .addEventListener("click", () => {
                moveMonth(-1);
                render(container);
            });

        container
            .querySelector("#next-month")
            .addEventListener("click", () => {
                moveMonth(1);
                render(container);
            });

        container
            .querySelectorAll("[data-date]")
            .forEach(row => {
                row.addEventListener("click", () => {
                    const date = Calc.parseKey(row.dataset.date);

                    DeliveryBook.DayView.setDate(date);
                    DeliveryBook.App.showView("day");
                });
            });
    }

    return Object.freeze({ render, setMonth });
})();
