window.DeliveryBook = window.DeliveryBook || {};

DeliveryBook.App = (() => {
    const Calc = DeliveryBook.Calc;
    const Data = DeliveryBook.Data;

    let currentView = "day";

    /* ==================================================
       토스트
       ================================================== */

    function showToast(message) {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");

        toast.className = "toast";
        toast.textContent = message;

        container.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    /* ==================================================
       동기화 상태 배지
       ================================================== */

    function renderSyncBadge() {
        const badge = document.getElementById("sync-badge");

        badge.classList.remove("ok", "pending", "error");

        /* github.io가 아니면 로컬 테스트 — 동기화 대상 없음 */
        if (!location.hostname.endsWith(".github.io")) {
            badge.textContent = "로컬 테스트";
            return;
        }

        const syncState = Data.getSyncState();

        if (syncState === "ok") {
            badge.classList.add("ok");
            badge.textContent = "☁ 동기화됨";
        } else if (syncState === "pending") {
            badge.classList.add("pending");
            badge.textContent = "● 이 기기에만 저장";
        } else {
            badge.classList.add("error");
            badge.textContent = "⚠ 동기화 실패";
        }
    }

    /* 저장 후 공통 처리 */
    function afterSync(result) {
        renderSyncBadge();

        if (result.ok && !result.skipped) {
            showToast("저장했습니다. 다른 기기에도 곧 반영됩니다.");
        } else if (result.ok) {
            showToast("저장했습니다.");
        } else {
            showToast(
                "이 기기에만 저장됐습니다. (" + result.reason + ")"
            );
        }
    }

    /* ==================================================
       헤더 부제
       ================================================== */

    function renderHeader() {
        const now = new Date();

        document.getElementById("header-month").textContent =
            now.getFullYear() + "년 " + (now.getMonth() + 1) + "월 " +
            now.getDate() + "일 " + Calc.weekdayName(now) + "요일";
    }

    /* ==================================================
       뷰 전환
       ================================================== */

    function showView(viewName) {
        currentView = viewName;

        document
            .querySelectorAll(".nav-button")
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.view === viewName
                );
            });

        const main = document.getElementById("main-view");

        if (viewName === "day") {
            DeliveryBook.DayView.render(main);
        } else if (viewName === "month") {
            DeliveryBook.MonthView.render(main);
        } else if (viewName === "settings") {
            renderSettings(main);
        }

        window.scrollTo(0, 0);
    }

    /* ==================================================
       설정 뷰
       ================================================== */

    function renderSettings(container) {
        const hasToken = Boolean(Data.getToken());
        const taxRatePercent =
            Math.round(Data.getTaxRate() * 1000) / 10;

        container.innerHTML =
            '<section class="panel">' +
                '<h2 class="panel-title">세율 설정</h2>' +
                '<div class="field settings-field">' +
                    '<label for="f-tax-rate">예상 세율 (%)</label>' +
                    '<input id="f-tax-rate" type="number" ' +
                        'inputmode="decimal" step="0.1" min="0" max="100" ' +
                        'value="' + taxRatePercent + '">' +
                    '<p class="field-hint">' +
                        "수입(배민+쿠팡)의 이 비율만큼 세금으로 떼어둡니다. " +
                        "현재 시트 기준 12.5%입니다." +
                    '</p>' +
                '</div>' +
                '<div class="button-row">' +
                    '<button type="button" class="action-button secondary" ' +
                        'id="save-tax-rate">세율 저장</button>' +
                '</div>' +
            '</section>' +

            '<section class="panel">' +
                '<h2 class="panel-title">GitHub 동기화</h2>' +
                '<div class="field settings-field">' +
                    '<label for="f-gh-token">' +
                        "GitHub 토큰 (기기별 최초 1회)" +
                    '</label>' +
                    '<input id="f-gh-token" type="password" ' +
                        'value="' + (hasToken ? Data.getToken() : "") + '" ' +
                        'placeholder="토큰 붙여넣기">' +
                    '<p class="field-hint">' +
                        "토큰은 이 브라우저에만 저장됩니다. " +
                        "GitHub → Settings → Developer settings → " +
                        "Personal access tokens 에서 " +
                        "이 저장소의 contents 권한으로 발급하세요. " +
                        (hasToken
                            ? "현재 저장되어 있습니다."
                            : "아직 저장되지 않았습니다.") +
                    '</p>' +
                '</div>' +
                '<div class="button-row">' +
                    '<button type="button" class="action-button secondary" ' +
                        'id="save-token">토큰 저장</button>' +
                    '<button type="button" class="action-button" ' +
                        'id="sync-now">지금 동기화</button>' +
                '</div>' +
            '</section>' +

            '<section class="panel">' +
                '<h2 class="panel-title">데이터 백업</h2>' +
                '<p class="field-hint">' +
                    "현재 기록 전체를 JSON 파일로 내려받습니다. " +
                    "진짜 데이터는 GitHub 저장소의 " +
                    "data/entries.json 에 있습니다." +
                '</p>' +
                '<div class="button-row">' +
                    '<button type="button" class="action-button secondary" ' +
                        'id="download-json">entries.json 다운로드</button>' +
                '</div>' +
            '</section>';

        bindSettings(container);
    }

    function bindSettings(container) {
        container
            .querySelector("#save-tax-rate")
            .addEventListener("click", async () => {
                const percent = Number(
                    container.querySelector("#f-tax-rate").value
                );

                if (
                    !Number.isFinite(percent) ||
                    percent < 0 ||
                    percent > 100
                ) {
                    showToast("세율을 확인해 주세요. (0~100)");
                    return;
                }

                const result = await Data.saveTaxRate(percent / 100);

                afterSync(result);
            });

        container
            .querySelector("#save-token")
            .addEventListener("click", () => {
                const value = container
                    .querySelector("#f-gh-token")
                    .value.trim();

                Data.setToken(value);

                showToast(
                    value
                        ? "토큰을 이 브라우저에 저장했습니다."
                        : "토큰을 삭제했습니다."
                );
            });

        container
            .querySelector("#sync-now")
            .addEventListener("click", async () => {
                const button = container.querySelector("#sync-now");

                button.disabled = true;
                button.textContent = "동기화 중...";

                const result = await Data.sync();

                afterSync(result);

                button.disabled = false;
                button.textContent = "지금 동기화";
            });

        container
            .querySelector("#download-json")
            .addEventListener("click", () => {
                const state = Data.getState();

                const blob = new Blob(
                    [JSON.stringify(state, null, 2)],
                    { type: "application/json;charset=utf-8" }
                );

                const link = document.createElement("a");

                link.href = URL.createObjectURL(blob);
                link.download = "entries.json";
                link.click();

                URL.revokeObjectURL(link.href);

                showToast("entries.json을 다운로드했습니다.");
            });
    }

    /* ==================================================
       초기화
       ================================================== */

    async function init() {
        renderHeader();
        renderSyncBadge();

        document
            .querySelectorAll(".nav-button")
            .forEach(button => {
                button.addEventListener("click", () => {
                    showView(button.dataset.view);
                });
            });

        const main = document.getElementById("main-view");

        main.innerHTML =
            '<div class="loading-state">' +
                "기록을 불러오는 중입니다..." +
            '</div>';

        await Data.load();

        renderSyncBadge();

        /* 첫 화면: 오늘 날짜 입력폼 */
        DeliveryBook.DayView.setDate(new Date());
        DeliveryBook.MonthView.setMonth(
            new Date().getFullYear(),
            new Date().getMonth()
        );

        showView("day");
    }

    document.addEventListener("DOMContentLoaded", init);

    return Object.freeze({ showView, showToast, afterSync });
})();
