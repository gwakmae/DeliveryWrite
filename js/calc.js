window.DeliveryBook = window.DeliveryBook || {};

/* ======================================================
   계산 로직

   스프레드시트 수식을 그대로 옮긴 것:
   - 예상세금 = (배민 + 쿠팡) × 세율
   - 일일 합계 = (배민 + 쿠팡) − 예상세금 − 지출
   - 지출 = 주유비 + 수리비 + 기타

   계산은 소수점까지 정확하게 하고,
   화면의 "실수령" 표시만 정수로 반올림한다.
   ====================================================== */

DeliveryBook.Calc = (() => {
    function num(value) {
        const n = Number(value);

        return Number.isFinite(n) ? n : 0;
    }

    /* 하루치 계산. entry가 없으면(미입력 날) null 반환 */
    function day(entry, taxRate) {
        if (!entry) {
            return null;
        }

        const baemin = num(entry.baemin);
        const coupang = num(entry.coupang);
        const income = baemin + coupang;
        const tax = income * taxRate;

        const fuel = num(entry.fuel);
        const repair = num(entry.repair);
        const other = num(entry.other);
        const expense = fuel + repair + other;

        const net = income - tax - expense;

        return {
            baemin: baemin,
            coupang: coupang,
            income: income,
            tax: tax,
            fuel: fuel,
            repair: repair,
            other: other,
            expense: expense,
            net: net
        };
    }

    /* 한 달 합계. entries는 { "2026-08-01": {...} } 형태 */
    function month(entries, year, monthIndex, taxRate) {
        const prefix =
            year + "-" + String(monthIndex + 1).padStart(2, "0");

        const total = {
            income: 0,
            tax: 0,
            expense: 0,
            net: 0,
            days: 0
        };

        Object.keys(entries).forEach(dateKey => {
            if (!dateKey.startsWith(prefix)) {
                return;
            }

            const result = day(entries[dateKey], taxRate);

            if (!result) {
                return;
            }

            total.income += result.income;
            total.tax += result.tax;
            total.expense += result.expense;
            total.net += result.net;
            total.days += 1;
        });

        return total;
    }

    /* 날짜 문자열 도구 */
    function dateKey(date) {
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");

        return date.getFullYear() + "-" + m + "-" + d;
    }

    function parseKey(key) {
        const parts = key.split("-").map(Number);

        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

    function weekdayName(date) {
        return WEEKDAYS[date.getDay()];
    }

    /* 숫자 표시: 1,234.5 형태 (소수점은 있을 때만) */
    function fmt(n) {
        return Number(n).toLocaleString("ko-KR", {
            maximumFractionDigits: 2
        });
    }

    /* 실수령 표시용: 정수로 반올림 (1,234 형태) */
    function fmtNet(n) {
        return Math.round(Number(n)).toLocaleString("ko-KR");
    }

    return Object.freeze({
        day,
        month,
        dateKey,
        parseKey,
        weekdayName,
        fmt,
        fmtNet
    });
})();
