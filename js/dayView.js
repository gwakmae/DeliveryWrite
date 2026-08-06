window.DeliveryBook = window.DeliveryBook || {};

/* ======================================================
   일별 입력 뷰

   - 앱을 열면 오늘 날짜로 바로 뜬다
   - 수입(배민/쿠팡)은 항상 보이고,
     지출(주유비/수리비/기타)은 접이식이다
   - 입력하는 즉시 세금·실수령액이 계산된다
   ====================================================== */

DeliveryBook.DayView = (() => {
    const Calc = DeliveryBook.Calc;
    const Data = DeliveryBook.Data;

    /* 현재 보고 있는 날짜 (Date 객체) */
    let currentDate = new Date();

    function setDate(date) {
        currentDate = date;
    }

    function getDate() {
        return currentDate;
    }

    function moveDay(offset) {
        const d = new Date(currentDate);

        d.setDate(d.getDate() + offset);

        currentDate = d;
    }

    function isToday() {
        return Calc.dateKey(currentDate) ===
            Calc.dateKey(new Date());
    }

    /* ==================================================
       렌더링
       ================================================== */

    function render(container) {
        const key = Calc.dateKey(currentDate);
        const entry = Data.getEntry(key);
        const hasEntry = Boolean(entry);

        const weekday = Calc.weekdayName(currentDate);
        const dayOfWeek = currentDate.getDay();
        const weekdayClass =
            dayOfWeek === 0 ? "sun" : dayOfWeek === 6 ? "sat" : "";

        const expenseSum = entry
            ? (Number(entry.fuel) || 0) +
              (Number(entry.repair) || 0) +
              (Number(entry.other) || 0)
            : 0;

        /* 지출이 있으면 접이식을 펼친 상태로 */
        const detailsOpen = expenseSum > 0 ? " open" : "";

        container.innerHTML =
            '<section class="panel">' +
                '<div class="day-header">' +
                    '<button type="button" class="day-nav-btn" ' +
                        'id="prev-day" aria-label="전날">◀</button>' +

                    '<div class="day-title">' +
                        '<span class="date">' +
                            (currentDate.getMonth() + 1) + "월 " +
                            currentDate.getDate() + "일" +
                        '</span>' +
                        '<span class="weekday ' + weekdayClass + '">' +
                            weekdayName() + "요일" +
                        '</span>' +
                        (isToday()
                            ? '<span class="today-pill">오늘</span>'
                            : "") +
                    '</div>' +

                    '<button type="button" class="day-nav-btn" ' +
                        'id="next-day" aria-label="다음날">▶</button>' +
                '</div>' +

                '<div class="field">' +
                    '<label for="f-baemin">배민 수입</label>' +
                    '<div class="money-input-wrap">' +
                        '<input id="f-baemin" type="number" ' +
                            'inputmode="numeric" min="0" ' +
                            'placeholder="0" ' +
                            'value="' + valueOrEmpty(entry, "baemin") + '">' +
                        '<span class="won">원</span>' +
                    '</div>' +
                '</div>' +

                '<div class="field">' +
                    '<label for="f-coupang">쿠팡 수입</label>' +
                    '<div class="money-input-wrap">' +
                        '<input id="f-coupang" type="number" ' +
                            'inputmode="numeric" min="0" ' +
                            'placeholder="0" ' +
                            'value="' + valueOrEmpty(entry, "coupang") + '">' +
                        '<span class="won">원</span>' +
                    '</div>' +
                '</div>' +

                '<details class="expense-details"' + detailsOpen + '>' +
                    '<summary>' +
                        '<span>지출 (주유비 · 수리비 · 기타)</span>' +
                        '<span class="expense-sum" id="expense-sum">' +
                            (expenseSum > 0
                                ? "-" + Calc.fmt(expenseSum) + "원"
                                : "") +
                        '</span>' +
                    '</summary>' +

                    '<div class="expense-body">' +
                        '<div class="field">' +
                            '<label for="f-fuel">주유비</label>' +
                            '<div class="money-input-wrap">' +
                                '<input id="f-fuel" type="number" ' +
                                    'inputmode="numeric" min="0" ' +
                                    'placeholder="0" ' +
                                    'value="' + valueOrEmpty(entry, "fuel") + '">' +
                                '<span class="won">원</span>' +
                            '</div>' +
                        '</div>' +

                        '<div class="field">' +
                            '<label for="f-repair">오토바이 수리비</label>' +
                            '<div class="money-input-wrap">' +
                                '<input id="f-repair" type="number" ' +
                                    'inputmode="numeric" min="0" ' +
                                    'placeholder="0" ' +
                                    'value="' + valueOrEmpty(entry, "repair") + '">' +
                                '<span class="won">원</span>' +
                            '</div>' +
                        '</div>' +

                        '<div class="field">' +
                            '<label for="f-other">기타 지출</label>' +
                            '<div class="money-input-wrap">' +
                                '<input id="f-other" type="number" ' +
                                    'inputmode="numeric" min="0" ' +
                                    'placeholder="0" ' +
                                    'value="' + valueOrEmpty(entry, "other") + '">' +
                                '<span class="won">원</span>' +
                            '</div>' +
                        '</div>' +

                        '<div class="field">' +
                            '<label for="f-note">메모 (선택)</label>' +
                            '<input id="f-note" type="text" ' +
                                'placeholder="예: 타이어 교체" ' +
                                'value="' +
                                    (entry && entry.note ? entry.note : "") +
                                '">' +
                        '</div>' +
                    '</div>' +
                '</details>' +

                '<div class="calc-preview" id="calc-preview"></div>' +

                '<div class="button-row">' +
                    '<button type="button" class="action-button" ' +
                        'id="save-entry">저장</button>' +
                    (hasEntry
                        ? '<button type="button" ' +
                          'class="action-button danger" ' +
                          'id="delete-entry">이 날 기록 삭제</button>'
                        : "") +
                '</div>' +
            '</section>';

        bindEvents(container);
        refreshCalc(container);
    }

    function weekdayName() {
        return Calc.weekdayName(currentDate);
    }

    function valueOrEmpty(entry, key) {
        if (!entry || !entry[key]) {
            return "";
        }

        return entry[key];
    }

    /* ==================================================
       폼 읽기 / 실시간 계산
       ================================================== */

    function readForm(container) {
        return {
            baemin: container.querySelector("#f-baemin").value,
            coupang: container.querySelector("#f-coupang").value,
            fuel: container.querySelector("#f-fuel").value,
            repair: container.querySelector("#f-repair").value,
            other: container.querySelector("#f-other").value,
            note: container.querySelector("#f-note").value
        };
    }

    function refreshCalc(container) {
        const form = readForm(container);
        const result = Calc.day(form, Data.getTaxRate());

        const expenseSum = result.fuel + result.repair + result.other;
        const netClass = result.net < 0 ? " negative" : "";

        container.querySelector("#calc-preview").innerHTML =
            '<div class="calc-row">' +
                '<span>총 수입 (배민 + 쿠팡)</span>' +
                '<span class="value">' +
                    Calc.fmt(result.income) + "원" +
                '</span>' +
            '</div>' +
            '<div class="calc-row tax">' +
                '<span>예상 세금 (' +
                    Math.round(Data.getTaxRate() * 1000) / 10 +
                    '%)</span>' +
                '<span class="value">-' +
                    Calc.fmt(result.tax) + "원" +
                '</span>' +
            '</div>' +
            '<div class="calc-row expense">' +
                '<span>지출 합계</span>' +
                '<span class="value">-' +
                    Calc.fmt(expenseSum) + "원" +
                '</span>' +
            '</div>' +
            '<div class="calc-row net">' +
                '<span>오늘 실수령</span>' +
                '<span class="value' + netClass + '">' +
                    Calc.fmt(result.net) + "원" +
                '</span>' +
            '</div>';

        /* 접이식 요약에도 지출 합계 반영 */
        const sumEl = container.querySelector("#expense-sum");

        if (sumEl) {
            sumEl.textContent =
                expenseSum > 0
                    ? "-" + Calc.fmt(expenseSum) + "원"
                    : "";
        }
    }

    function isFormEmpty(container) {
        const form = readForm(container);

        return (
            !form.baemin &&
            !form.coupang &&
            !form.fuel &&
            !form.repair &&
            !form.other &&
            !form.note.trim()
        );
    }

    /* ==================================================
       이벤트
       ================================================== */

    function bindEvents(container) {
        container
            .querySelectorAll("input")
            .forEach(el => {
                el.addEventListener("input", () => {
                    refreshCalc(container);
                });
            });

        container
            .querySelector("#prev-day")
            .addEventListener("click", () => {
                moveDay(-1);
                render(container);
            });

        container
            .querySelector("#next-day")
            .addEventListener("click", () => {
                moveDay(1);
                render(container);
            });

        container
            .querySelector("#save-entry")
            .addEventListener("click", async () => {
                const key = Calc.dateKey(currentDate);
                const button = container.querySelector("#save-entry");

                if (isFormEmpty(container)) {
                    DeliveryBook.App.showToast(
                        "입력된 내용이 없습니다."
                    );
                    return;
                }

                button.disabled = true;
                button.textContent = "저장 중...";

                const result = await Data.saveEntry(
                    key,
                    readForm(container)
                );

                DeliveryBook.App.afterSync(result);

                render(container);
            });

        const deleteButton = container.querySelector("#delete-entry");

        if (deleteButton) {
            deleteButton.addEventListener("click", async () => {
                const label =
                    (currentDate.getMonth() + 1) + "월 " +
                    currentDate.getDate() + "일";

                const ok = window.confirm(
                    label + " 기록을 삭제할까요?"
                );

                if (!ok) {
                    return;
                }

                const key = Calc.dateKey(currentDate);

                const result = await Data.saveEntry(key, null);

                DeliveryBook.App.afterSync(result);

                render(container);
            });
        }
    }

    return Object.freeze({ render, setDate, getDate });
})();
