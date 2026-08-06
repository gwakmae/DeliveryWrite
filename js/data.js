window.DeliveryBook = window.DeliveryBook || {};

/* ======================================================
   데이터 저장소

   - 진짜 데이터는 GitHub 저장소의 data/entries.json에 있다
   - 읽기: Pages에서 fetch (토큰 불필요)
   - 쓰기: GitHub Contents API (토큰 필요)
   - 토큰은 이 브라우저 localStorage에만 보관된다
   - 저장 실패 시 변경분을 기기에 보관했다가 다음에 재시도
   ====================================================== */

DeliveryBook.Data = (() => {
    const TOKEN_KEY = "delivery_book_gh_token";
    const PENDING_KEY = "delivery_book_pending";

    /* 메모리상의 현재 상태 */
    let state = {
        taxRate: 0.125,
        entries: {}
    };

    /* 동기화 상태: ok / pending / error */
    let syncState = "pending";

    /* ==================================================
       토큰
       ================================================== */

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY) || "";
        } catch (e) {
            return "";
        }
    }

    function setToken(token) {
        try {
            if (token) {
                localStorage.setItem(TOKEN_KEY, token);
            } else {
                localStorage.removeItem(TOKEN_KEY);
            }
        } catch (e) {
            // localStorage 불가 환경이면 무시
        }
    }

    /* ==================================================
       미동기 변경분 (기기에 임시 보관)
       { upserts: {dateKey: entry}, deletes: [dateKey],
         taxRate: null | number }
       ================================================== */

    function getPending() {
        try {
            const raw = localStorage.getItem(PENDING_KEY);

            if (!raw) {
                return { upserts: {}, deletes: [], taxRate: null };
            }

            const parsed = JSON.parse(raw);

            return {
                upserts: parsed.upserts || {},
                deletes: parsed.deletes || [],
                taxRate:
                    typeof parsed.taxRate === "number"
                        ? parsed.taxRate
                        : null
            };
        } catch (e) {
            return { upserts: {}, deletes: [], taxRate: null };
        }
    }

    function setPending(pending) {
        try {
            const empty =
                Object.keys(pending.upserts).length === 0 &&
                pending.deletes.length === 0 &&
                pending.taxRate === null;

            if (empty) {
                localStorage.removeItem(PENDING_KEY);
            } else {
                localStorage.setItem(
                    PENDING_KEY,
                    JSON.stringify(pending)
                );
            }
        } catch (e) {
            // 무시
        }
    }

    function hasPending() {
        const p = getPending();

        return (
            Object.keys(p.upserts).length > 0 ||
            p.deletes.length > 0 ||
            p.taxRate !== null
        );
    }

    /* ==================================================
       현재 Pages가 서빙되는 저장소 추론
       gwakmae.github.io/delivery-book/
       → { owner: "gwakmae", repo: "delivery-book" }
       ================================================== */

    function hubRepo() {
        const match = location.hostname.match(
            /^([^.]+)\.github\.io$/
        );

        if (!match) {
            return null;
        }

        const owner = match[1];
        const seg = location.pathname
            .split("/")
            .filter(Boolean)[0];
        const repo = seg || owner + ".github.io";

        return { owner: owner, repo: repo };
    }

    /* ==================================================
       UTF-8 안전 base64
       ================================================== */

    function textToBase64(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = "";

        bytes.forEach(b => {
            binary += String.fromCharCode(b);
        });

        return btoa(binary);
    }

    function base64ToText(base64) {
        const binary = atob(base64.replace(/\s/g, ""));
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new TextDecoder().decode(bytes);
    }

    /* ==================================================
       데이터 정규화 (빈 값 제거)
       ================================================== */

    function normalizeEntry(entry) {
        const cleaned = {};

        ["baemin", "coupang", "fuel", "repair", "other"]
            .forEach(key => {
                const n = Number(entry[key]);

                if (Number.isFinite(n) && n !== 0) {
                    cleaned[key] = n;
                }
            });

        if (entry.note && String(entry.note).trim()) {
            cleaned.note = String(entry.note).trim();
        }

        /* 전부 비어 있으면 null (기록 없음 취급) */
        if (Object.keys(cleaned).length === 0) {
            return null;
        }

        return cleaned;
    }

    /* ==================================================
       읽기: Pages에서 entries.json 가져오기
       ================================================== */

    async function load() {
        const pending = getPending();

        try {
            const res = await fetch(
                "data/entries.json?ts=" + Date.now(),
                { cache: "no-store" }
            );

            if (!res.ok) {
                throw new Error("데이터 읽기 실패 (" + res.status + ")");
            }

            const remote = await res.json();

            state = {
                taxRate:
                    typeof remote.taxRate === "number"
                        ? remote.taxRate
                        : 0.125,
                entries: remote.entries || {}
            };

            /* 아직 동기화 안 된 기기 변경분을 얹는다 */
            applyPendingToState(pending);

            syncState = hasPending() ? "pending" : "ok";
        } catch (e) {
            /* 첫 실행 등 실패 시 로컬 pending이라도 표시 */
            applyPendingToState(pending);

            syncState = "error";
        }

        return state;
    }

    function applyPendingToState(pending) {
        if (pending.taxRate !== null) {
            state.taxRate = pending.taxRate;
        }

        Object.keys(pending.upserts).forEach(key => {
            state.entries[key] = pending.upserts[key];
        });

        pending.deletes.forEach(key => {
            delete state.entries[key];
        });
    }

    /* ==================================================
       쓰기: 로컬 상태 갱신 + pending 기록 + 동기화 시도
       ================================================== */

    function getState() {
        return state;
    }

    function getEntry(key) {
        return state.entries[key] || null;
    }

    function getTaxRate() {
        return state.taxRate;
    }

    function getSyncState() {
        return syncState;
    }

    /* 하루 기록 저장 (entry가 null이면 삭제) */
    async function saveEntry(key, entry) {
        const cleaned = entry ? normalizeEntry(entry) : null;
        const pending = getPending();

        if (cleaned) {
            state.entries[key] = cleaned;
            pending.upserts[key] = cleaned;
            pending.deletes = pending.deletes.filter(
                d => d !== key
            );
        } else {
            delete state.entries[key];
            delete pending.upserts[key];

            if (!pending.deletes.includes(key)) {
                pending.deletes.push(key);
            }
        }

        setPending(pending);

        return sync();
    }

    /* 세율 변경 */
    async function saveTaxRate(rate) {
        state.taxRate = rate;

        const pending = getPending();

        pending.taxRate = rate;

        setPending(pending);

        return sync();
    }

    /* ==================================================
       동기화: GitHub의 최신 파일과 pending을 병합해 업로드

       다른 기기에서 먼저 저장한 내용을 덮어쓰지 않도록
       매번 최신 원격 파일을 내려받은 뒤 pending만 얹는다.
       ================================================== */

    async function sync() {
        const token = getToken();
        const pending = getPending();

        if (!hasPending()) {
            syncState = "ok";
            return { ok: true, skipped: true };
        }

        if (!token) {
            syncState = "pending";
            return {
                ok: false,
                reason: "토큰이 없어 이 기기에만 저장되어 있습니다."
            };
        }

        const hub = hubRepo();

        if (!hub) {
            syncState = "pending";
            return {
                ok: false,
                reason: "github.io 주소가 아니어서 동기화할 수 없습니다."
            };
        }

        syncState = "pending";

        try {
            /* 1) 최신 원격 파일 + sha */
            const getRes = await fetch(
                "https://api.github.com/repos/" +
                    hub.owner + "/" + hub.repo +
                    "/contents/data/entries.json",
                {
                    headers: {
                        Authorization: "Bearer " + token,
                        Accept: "application/vnd.github+json"
                    },
                    cache: "no-store"
                }
            );

            if (!getRes.ok) {
                throw new Error(
                    "원격 파일 확인 실패 (" + getRes.status + ")"
                );
            }

            const fileData = await getRes.json();
            const remote = JSON.parse(
                base64ToText(fileData.content)
            );

            const merged = {
                taxRate:
                    pending.taxRate !== null
                        ? pending.taxRate
                        : typeof remote.taxRate === "number"
                          ? remote.taxRate
                          : 0.125,
                entries: remote.entries || {}
            };

            Object.keys(pending.upserts).forEach(key => {
                merged.entries[key] = pending.upserts[key];
            });

            pending.deletes.forEach(key => {
                delete merged.entries[key];
            });

            /* 날짜순 정렬 (보기 좋은 diff를 위해) */
            const sortedEntries = {};

            Object.keys(merged.entries)
                .sort()
                .forEach(key => {
                    sortedEntries[key] = merged.entries[key];
                });

            merged.entries = sortedEntries;

            /* 2) 업로드 */
            const putRes = await fetch(
                "https://api.github.com/repos/" +
                    hub.owner + "/" + hub.repo +
                    "/contents/data/entries.json",
                {
                    method: "PUT",
                    headers: {
                        Authorization: "Bearer " + token,
                        Accept: "application/vnd.github+json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        message: "data: 배달 기록 업데이트",
                        content: textToBase64(
                            JSON.stringify(merged, null, 2) + "\n"
                        ),
                        sha: fileData.sha
                    })
                }
            );

            if (!putRes.ok) {
                const errData = await putRes
                    .json()
                    .catch(() => ({}));

                throw new Error(
                    errData.message ||
                        "업로드 실패 (" + putRes.status + ")"
                );
            }

            /* 3) 성공: 메모리를 병합 결과로 교체, pending 비우기 */
            state = merged;

            setPending({
                upserts: {},
                deletes: [],
                taxRate: null
            });

            syncState = "ok";

            return { ok: true };
        } catch (e) {
            syncState = "error";

            return { ok: false, reason: e.message };
        }
    }

    return Object.freeze({
        load,
        getState,
        getEntry,
        getTaxRate,
        getSyncState,
        hasPending,
        saveEntry,
        saveTaxRate,
        sync,
        getToken,
        setToken
    });
})();
