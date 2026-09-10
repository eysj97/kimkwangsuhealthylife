(function () {
    "use strict";

    // 이 스크립트는 초록색 영역(주간 캘린더 + 영양소 캡슐 그래프)과
    // "오늘의 영양제" 빈 상태 마스코트 애니메이션을 담당합니다.
    // 나머지 화면은 여전히 정적 HTML/CSS입니다.

    // 모바일 브라우저는 100dvh를 지원 안 하거나(구형 브라우저) 값이 살짝 어긋나는
    // 경우가 있어서, 실제 보이는 높이(window.innerHeight)를 JS로 직접 재서
    // --vh100 변수에 저장해둠 — CSS의 100dvh보다 더 확실하게 맞음
    function updateViewportHeightVar() {
        document.documentElement.style.setProperty("--vh100", window.innerHeight + "px");
    }
    updateViewportHeightVar();
    window.addEventListener("resize", updateViewportHeightVar);
    window.addEventListener("orientationchange", updateViewportHeightVar);
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", updateViewportHeightVar);
    }

    const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

    // 캡슐 그래프의 각 영양소 막대 정보 (클릭 시 뜨는 설명 팝업에 사용)
    const NUTRIENT_SOURCES = [
        {
            key: "vitaminD",
            label: "비타민D",
            info: "칼슘 흡수를 도와 뼈와 치아 건강을 지키고, 면역 기능<br> 조절에도 관여해요. 햇빛을 받으면 피부에서 합성되기 때문에 실내 활동이 많으면 부족해지기 쉬워요.",
        },
        {
            key: "omega3",
            label: "오메가3",
            info: "혈행 개선과 혈중 중성지방 감소에 도움을 줄 수 있고,<br> 두뇌·눈 건강과도 관련이 깊은 필수 지방산이에요.",
        },
        {
            key: "magnesium",
            label: "마그네슘",
            info: "근육과 신경이 정상적으로 움직이도록 돕고<br> 에너지 대사에 관여해요. 부족하면 쉽게 피로하거나<br> 눈꺼풀이 떨릴 수 있어요.",
        },
        {
            key: "vitaminB12",
            label: "비타민B12",
            info: "적혈구를 만들고 신경 기능을 유지하는 데 필요해요.<br> 채식 위주 식단에서는 부족해지기 쉬운 영양소예요.",
        },
        {
            key: "probiotics",
            label: "프로바이오틱스",
            info: "장내 유익균을 늘려 장 건강과 배변 활동에 도움을 줄 수 있고,<br> 면역 기능 유지에도 관여해요.",
        },
        {
            key: "folatE",
            label: "엽산",
            info: "세포 분열과 혈액 생성에 필요한 비타민B군의 하나로, 특히 임신 중 태아 발달에 중요한 역할을 해요.",
        },
    ];

    // 건강상태 탭 과대/부족 카드에 쓰는 성분별 안내 문구
    const NUTRITION_HINTS = {
        vitaminD: { low: "부족하면 뼈가 약해지고 면역력이 떨어질 수 있어요.", over: "과다 섭취 시 고칼슘혈증 등 부작용이 있을 수 있어요." },
        omega3: { low: "부족하면 혈행 개선 효과를 충분히 기대하기 어려워요.", over: "과다 섭취 시 출혈 위험이 높아질 수 있어요." },
        magnesium: { low: "부족하면 근육 경련이나 피로감이 심해질 수 있어요.", over: "과다 섭취 시 설사나 복통이 있을 수 있어요." },
        vitaminB12: { low: "부족하면 빈혈이나 신경계 이상이 생길 수 있어요.", over: "과다 섭취해도 대부분 배출되지만 드물게 피부 트러블이 있을 수 있어요." },
        probiotics: { low: "부족하면 장내 유익균이 줄어 배변 활동이나 장 건강이 나빠질 수 있어요.", over: "과다 섭취 시 일시적으로 복부 팽만감이나 가스가 생길 수 있어요." },
        folatE: { low: "부족하면 빈혈이나 태아 발달에 영향을 줄 수 있어요.", over: "과다 섭취 시 비타민B12 결핍이 가려지거나 위장장애가 나타날 수 있어요." },
    };

    // ---------- 증상/상태별 추천 영양제 (데모용 샘플 데이터) ----------
    const RECOMMENDATIONS = {
        피로: ["비타민B군", "마그네슘"],
        감기: ["비타민C", "아연"],
        몸살: ["비타민C", "마그네슘"],
        소화불량: ["프로바이오틱스", "소화효소제"],
        음주: ["밀크시슬", "비타민B군"],
        불면: ["마그네슘", "테아닌"],
        "관절 통증": ["오메가3", "글루코사민"],
    };

    // ---------- 주간 캘린더: 가로 스크롤로 날짜 이동, 가운데 온 날짜가 자동 선택됨 ----------
    const CALENDAR_RANGE = 14; // 오늘 기준 앞뒤로 렌더링할 일수

    function findCenteredDay(weekEl) {
        const containerRect = weekEl.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        let closest = null;
        let closestDist = Infinity;
        weekEl.querySelectorAll(".calendar-day").forEach((day) => {
            const r = day.getBoundingClientRect();
            const center = r.left + r.width / 2;
            const dist = Math.abs(center - containerCenter);
            if (dist < closestDist) {
                closestDist = dist;
                closest = day;
            }
        });
        return closest;
    }

    function updateCalendarSelection(centerOffset) {
        const weekEl = document.querySelector(".calendar-week");
        const captionEl = document.querySelector(".calendar-date-caption");
        if (!weekEl || !captionEl) return;

        weekEl.querySelectorAll(".calendar-day").forEach((day) => {
            const offset = Number(day.dataset.offset);
            const dist = Math.abs(offset - centerOffset);
            day.classList.remove("selected");
            if (dist === 0) {
                day.classList.add("selected");
                day.style.opacity = "";
                day.style.filter = "";
            } else {
                // 오늘 기준 "이번 주"(앞3일~뒤3일)의 가장자리(dist 3)가 가장 흐리고,
                // 그 지점을 기준으로 더 멀어질수록(=다음/이전 주로 넘어갈수록) 다시 선명해짐
                const fold = dist <= 3 ? dist : Math.max(0, 6 - dist);
                const opacity = Math.max(0.35, 0.95 - fold * 0.18);
                const blur = fold >= 3 ? 1.5 : 0;
                day.style.opacity = String(opacity);
                day.style.filter = blur > 0 ? `blur(${blur}px)` : "";
            }
        });

        const centerDate = new Date();
        centerDate.setDate(centerDate.getDate() + centerOffset);
        captionEl.textContent = `${centerDate.getMonth() + 1}월 ${centerDate.getDate()}일 (${DAY_LABELS[centerDate.getDay()]})`;
    }

    function renderCalendar() {
        const weekEl = document.querySelector(".calendar-week");
        if (!weekEl) return;

        const today = new Date();
        weekEl.innerHTML = "";

        for (let offset = -CALENDAR_RANGE; offset <= CALENDAR_RANGE; offset++) {
            const d = new Date(today);
            d.setDate(d.getDate() + offset);

            const span = document.createElement("span");
            span.className = "calendar-day";
            span.dataset.offset = String(offset);
            span.textContent = offset === 0 ? "오늘" : DAY_LABELS[d.getDay()];
            weekEl.appendChild(span);
        }

        updateCalendarSelection(0);

        // 오늘 칸이 화면 가운데 오도록 초기 스크롤 위치를 맞춤
        requestAnimationFrame(() => {
            const todayEl = weekEl.querySelector('[data-offset="0"]');
            if (todayEl) {
                weekEl.scrollLeft = todayEl.offsetLeft - weekEl.clientWidth / 2 + todayEl.clientWidth / 2;
            }
        });

        // 스크롤 중 가운데로 온 날짜를 실시간으로 선택/캡션 갱신
        let scrollTicking = false;
        weekEl.addEventListener("scroll", () => {
            if (scrollTicking) return;
            scrollTicking = true;
            requestAnimationFrame(() => {
                scrollTicking = false;
                const centered = findCenteredDay(weekEl);
                if (centered) updateCalendarSelection(Number(centered.dataset.offset));
            });
        });

        // 터치/트랙패드 없이 마우스로만 쓰는 환경에서도 좌우로 끌어서 스크롤 가능하게
        let isDragging = false;
        let dragStartX = 0;
        let dragStartScrollLeft = 0;
        weekEl.addEventListener("mousedown", (e) => {
            isDragging = true;
            weekEl.classList.add("dragging");
            dragStartX = e.pageX;
            dragStartScrollLeft = weekEl.scrollLeft;
        });
        window.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            e.preventDefault();
            weekEl.scrollLeft = dragStartScrollLeft - (e.pageX - dragStartX);
        });
        window.addEventListener("mouseup", () => {
            isDragging = false;
            weekEl.classList.remove("dragging");
        });

        // 세로 마우스 휠도 좌우 스크롤로 변환
        weekEl.addEventListener(
            "wheel",
            (e) => {
                if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
                e.preventDefault();
                weekEl.scrollLeft += e.deltaY;
            },
            { passive: false }
        );
    }

    // ---------- 영양소 캡슐 클릭 시 해당 영양소 역할 설명 팝업 ----------
    function showNutrientInfo(source) {
        const host = document.querySelector(".top") || document.body;
        const existing = host.querySelector(".nutrient-info-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.className = "nutrient-info-overlay";
        overlay.innerHTML =
            '<div class="nutrient-info-sheet">' +
            "<h3>" + source.label + "</h3>" +
            "<p>" + source.info + "</p>" +
            '<button type="button" data-close>확인</button>' +
            "</div>";
        host.appendChild(overlay);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay || e.target.closest("[data-close]")) overlay.remove();
        });
    }

    function handleBoxGrapClick(e) {
        const line = e.target.closest(".lineBasic");
        if (!line) return;
        const fillEl = line.querySelector(".nutrient-fill");
        if (!fillEl) return;
        const source = NUTRIENT_SOURCES.find((nu) => fillEl.classList.contains(nu.key));
        if (source) showNutrientInfo(source);
    }

    // ---------- "오늘의 영양제" 빈 상태 마스코트: 홈에 들어갈 때마다 랜덤으로 하나 표시 ----------
    // 아직 아무 영양제도 선택하지 않았을 때 보여주는 대기 화면 이미지.
    // 접속 시간대별로 다른 3장 세트에서 무작위로 고름 (7-13시 / 13-17시 / 17-7시, 자정 넘어감).
    const WAITING_IMAGE_GROUPS = [
        { start: 7, end: 13, files: ["images/logo-waiting1.png", "images/logo-waiting2.png", "images/logo-waiting3.png"] },
        { start: 13, end: 17, files: ["images/logo-waiting4.png", "images/logo-waiting5.png", "images/logo-waiting6.png"] },
        { start: 17, end: 7, files: ["images/logo-waiting7.png", "images/logo-waiting8.png", "images/logo-waiting9.png"] },
    ];

    function getWaitingImagesForNow() {
        const hour = new Date().getHours();
        const group = WAITING_IMAGE_GROUPS.find((g) =>
            g.start < g.end ? hour >= g.start && hour < g.end : hour >= g.start || hour < g.end
        );
        return group ? group.files : WAITING_IMAGE_GROUPS[0].files;
    }

    function showRandomWaitingMascot() {
        const img = document.getElementById("waiting-mascot");
        if (!img) return;
        const files = getWaitingImagesForNow();
        img.src = files[Math.floor(Math.random() * files.length)];
    }

    // ---------- 정해진 시각에 "영양제를 복용하세요" 알림 ----------
    // 브라우저 알림(Notification) 기능을 사용하며, 이 탭이 열려 있을 때만 동작함.
    // OS 설정에 따라 잠금화면에도 표시될 수 있지만, 탭이 닫혀 있으면 절대 뜨지 않음.
    const REMINDER_TIMES = [
        { hour: 11, minute: 0, groupIndex: 0, files: WAITING_IMAGE_GROUPS[0].files },
        { hour: 14, minute: 0, groupIndex: 1, files: WAITING_IMAGE_GROUPS[1].files },
        { hour: 2, minute: 0, groupIndex: 2, files: WAITING_IMAGE_GROUPS[2].files },
    ];
    const REMINDER_FIRED_KEY_PREFIX = "pt_reminder_fired_";

    function localDateKey(d) {
        return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    }

    function fireReminderNotification(files) {
        if (!("Notification" in window)) return;
        const image = files[Math.floor(Math.random() * files.length)];

        const show = () => {
            new Notification("영양제를 복용하세요", {
                body: "지금 복용할 시간이에요.",
                icon: image,
                image: image,
            });
        };

        if (Notification.permission === "granted") {
            show();
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") show();
            });
        }
    }

    function checkReminders() {
        const now = new Date();
        const dateKey = localDateKey(now);

        REMINDER_TIMES.forEach((reminder, index) => {
            if (now.getHours() !== reminder.hour || now.getMinutes() !== reminder.minute) return;

            const firedKey = REMINDER_FIRED_KEY_PREFIX + index + "_" + dateKey;
            if (localStorage.getItem(firedKey)) return;
            localStorage.setItem(firedKey, "1");

            fireReminderNotification(reminder.files);
        });
    }

    // ---------- 서버 푸시 알림: 앱이 완전히 꺼져 있어도, 잠금화면이나 다른 앱을 쓰는 중에도
    // 정해진 시각(11시/14시/새벽2시)에 팝업이 뜨게 함. /api/subscribe + /api/schedule-general-reminders
    // (QStash 예약) + /api/send-push가 필요하며, 서버 쪽 환경변수가 아직 없으면 조용히 실패함 ----------
    const VAPID_PUBLIC_KEY = "BCGrncozgG5xf69AUyHR38yr11hUrIQF0JvMuDoYE2BY65oWSXfmzNFfol2nStq7QdxcBbsVHm6vQZPddvEh3hM";
    const PUSH_USER_ID_KEY = "gwangja_push_user_id";
    const PUSH_SCHEDULED_KEY = "gwangja_general_push_scheduled_v1";

    function getOrCreatePushUserId() {
        let id = localStorage.getItem(PUSH_USER_ID_KEY);
        if (!id) {
            id = "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
            localStorage.setItem(PUSH_USER_ID_KEY, id);
        }
        return id;
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
    }

    // 잠금화면 알림까지 받으려면 서버에 구독 등록 + 예약이 모두 성공해야 하므로,
    // 실패해도 조용히 넘어가고(탭이 열려있을 때 뜨는 로컬 알림은 이미 별도로 동작함) 콘솔에만 남김
    async function setupGeneralServerPushReminders() {
        try {
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
            const registration = await navigator.serviceWorker.ready;

            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
            }

            const userId = getOrCreatePushUserId();

            await fetch("/api/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, subscription }),
            }).then((r) => {
                if (!r.ok) throw new Error("subscribe failed");
            });

            await fetch("/api/schedule-general-reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    times: REMINDER_TIMES.map((r) => ({ hour: r.hour, minute: r.minute, groupIndex: r.groupIndex })),
                }),
            }).then((r) => {
                if (!r.ok) throw new Error("schedule failed");
            });

            localStorage.setItem(PUSH_SCHEDULED_KEY, "1");
            return true;
        } catch (err) {
            console.warn("잠금화면 알림 설정에 실패했어요(서버 설정이 아직 안 됐을 수 있어요):", err);
            return false;
        }
    }

    // 처음 접속했을 때 딱 한 번만 팝업으로 알림 허용 여부를 물어봄(배너로 계속 떠있지 않게)
    const PUSH_ASKED_KEY = "gwangja_push_asked_v1";

    function maybeShowPushPermissionModal() {
        if (localStorage.getItem(PUSH_ASKED_KEY)) return;
        if (!("Notification" in window) || Notification.permission !== "default") return;

        const host = document.querySelector(".top") || document.body;
        const overlay = document.createElement("div");
        overlay.className = "push-permission-overlay";
        overlay.innerHTML = `
            <div class="push-permission-sheet">
                <div class="push-permission-icon">🔔</div>
                <h3>복용 알림을 받아보시겠어요?</h3>
                <p>앱을 켜두지 않아도, 잠금화면에서 정해진 시간에 영양제 복용 알림을 받을 수 있어요.</p>
                <div class="push-permission-sheet-actions">
                    <button type="button" data-action="push-allow">알림 받기</button>
                    <button type="button" data-action="push-dismiss">다음에 할게요</button>
                </div>
            </div>
        `;
        host.appendChild(overlay);

        const close = () => overlay.remove();

        overlay.querySelector('[data-action="push-allow"]').addEventListener("click", () => {
            Notification.requestPermission().then((permission) => {
                localStorage.setItem(PUSH_ASKED_KEY, "1");
                close();
                if (permission === "granted") setupGeneralServerPushReminders();
            });
        });
        overlay.querySelector('[data-action="push-dismiss"]').addEventListener("click", () => {
            localStorage.setItem(PUSH_ASKED_KEY, "1");
            close();
        });
    }

    // 서버에 예약해둔 QStash 스케줄과 구독 정보를 모두 지워서 알림을 완전히 끔
    async function disableGeneralServerPushReminders() {
        localStorage.removeItem(PUSH_SCHEDULED_KEY);
        try {
            const userId = localStorage.getItem(PUSH_USER_ID_KEY);
            if (!userId) return;
            await fetch("/api/unsubscribe-reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
        } catch (err) {
            console.warn("알림 해제 요청에 실패했어요:", err);
        }
    }

    // 건강상태 탭 맨 아래 "잠금화면 복용 알림" 토글
    function wirePushToggle() {
        const toggle = document.getElementById("push-toggle");
        if (!toggle) return;

        const isOn = () =>
            "Notification" in window && Notification.permission === "granted" && !!localStorage.getItem(PUSH_SCHEDULED_KEY);

        toggle.setAttribute("aria-checked", String(isOn()));

        toggle.addEventListener("click", () => {
            if (!("Notification" in window)) {
                alert("이 브라우저는 알림 기능을 지원하지 않아요.");
                return;
            }

            const nowOn = toggle.getAttribute("aria-checked") === "true";
            if (nowOn) {
                toggle.setAttribute("aria-checked", "false");
                disableGeneralServerPushReminders();
                return;
            }

            if (Notification.permission === "denied") {
                alert("알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림 권한을 허용해주세요.");
                return;
            }

            const grantAndEnable = () => {
                localStorage.setItem(PUSH_ASKED_KEY, "1");
                setupGeneralServerPushReminders().then((ok) => {
                    toggle.setAttribute("aria-checked", String(!!ok));
                });
            };

            if (Notification.permission === "granted") {
                grantAndEnable();
            } else {
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") grantAndEnable();
                    else toggle.setAttribute("aria-checked", "false");
                });
            }
        });
    }

    // ---------- 영양제 등록: 사진 촬영(제품 전체 / 성분표) → 상세정보 입력 ----------
    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    let capturedPhotos = { product: null, label: null }; // { file, url }
    let draftQty = 30;

    function closeCaptureOverlay() {
        const el = document.getElementById("capture-overlay");
        if (el) el.remove();
    }

    function closeDetailOverlay() {
        const el = document.getElementById("detail-overlay");
        if (el) el.remove();
    }

    function resetCapturedPhotos() {
        Object.values(capturedPhotos).forEach((p) => p && URL.revokeObjectURL(p.url));
        capturedPhotos = { product: null, label: null };
    }

    function openCaptureOverlay() {
        closeCaptureOverlay();
        closeDetailOverlay();
        const host = document.querySelector(".top") || document.body;

        const overlay = document.createElement("div");
        overlay.className = "capture-overlay";
        overlay.id = "capture-overlay";
        overlay.innerHTML = `
            <div class="capture-sheet">
                <div class="capture-header">
                    <span>영양제 등록</span>
                    <button type="button" class="capture-close" data-close>✕</button>
                </div>
                <p class="capture-hint">영양제 사진을 촬영해 주세요</p>
                <div class="capture-slot-row">
                    ${["product", "label"]
                        .map(
                            (key) => `
                    <label class="capture-slot${capturedPhotos[key] ? " filled" : ""}" data-slot="${key}">
                        <input type="file" accept="image/*" capture="environment" hidden>
                        <div class="capture-slot-inner">
                            ${
                                capturedPhotos[key]
                                    ? `<img src="${capturedPhotos[key].url}" alt=""><span class="capture-retake">다시 촬영</span>`
                                    : `<span class="capture-icon">📷</span><span class="capture-label">${key === "product" ? "제품 전체 사진" : "영양 성분표 사진"}</span>`
                            }
                        </div>
                    </label>`
                        )
                        .join("")}
                </div>
                <button type="button" class="capture-next" data-action="capture-next" ${capturedPhotos.product && capturedPhotos.label ? "" : "disabled"}>다음</button>
            </div>
        `;
        host.appendChild(overlay);

        function updateNextEnabled() {
            overlay.querySelector(".capture-next").disabled = !(capturedPhotos.product && capturedPhotos.label);
        }

        overlay.querySelectorAll(".capture-slot").forEach((slot) => {
            const key = slot.dataset.slot;
            const input = slot.querySelector("input[type=file]");
            input.addEventListener("change", () => {
                const file = input.files && input.files[0];
                if (!file) return;
                if (capturedPhotos[key]) URL.revokeObjectURL(capturedPhotos[key].url);
                const url = URL.createObjectURL(file);
                capturedPhotos[key] = { file, url };
                slot.classList.add("filled");
                slot.querySelector(".capture-slot-inner").innerHTML = `<img src="${url}" alt=""><span class="capture-retake">다시 촬영</span>`;
                updateNextEnabled();
            });
        });

        overlay.querySelector("[data-close]").addEventListener("click", () => {
            resetCapturedPhotos();
            closeCaptureOverlay();
        });

        overlay.querySelector('[data-action="capture-next"]').addEventListener("click", () => {
            closeCaptureOverlay();
            openDetailOverlay();
        });
    }

    function openDetailOverlay() {
        if (!capturedPhotos.product || !capturedPhotos.label) return;
        closeDetailOverlay();
        const host = document.querySelector(".top") || document.body;
        draftQty = 30;

        const overlay = document.createElement("div");
        overlay.className = "detail-overlay";
        overlay.id = "detail-overlay";
        overlay.innerHTML = `
            <div class="detail-sheet">
                <div class="detail-hero">
                    <button type="button" class="detail-icon-btn detail-back" data-action="detail-back"><img class="detail-back-icon" src="images/icon-return.png" alt="뒤로"></button>
                    <button type="button" class="detail-icon-btn detail-close" data-close>✕</button>
                    <img class="detail-hero-image" id="detail-hero-image" src="${capturedPhotos.product.url}" alt="">
                    <div class="detail-thumbs">
                        <button type="button" class="detail-thumb active" data-thumb="product"><img src="${capturedPhotos.product.url}" alt=""></button>
                        <button type="button" class="detail-thumb" data-thumb="label"><img src="${capturedPhotos.label.url}" alt=""></button>
                    </div>
                </div>
                <form class="detail-body" id="detail-form">
                    <input type="text" class="detail-name-input" id="d-name" placeholder="제품명을 입력하세요" required>
                    <div class="detail-sub-row">
                        <span>1회</span>
                        <input type="text" class="detail-sub-input" id="d-dosage" value="1" inputmode="numeric">
                        <select id="d-unit">
                            <option>정</option>
                            <option>캡슐</option>
                            <option>ml</option>
                            <option>포</option>
                        </select>
                        <span>복용</span>
                    </div>

                    <div class="detail-qty-row">
                        <div class="detail-qty-label">현재 재고</div>
                        <div class="inv-qty-control">
                            <button type="button" class="qty-btn" data-action="d-dec">－</button>
                            <span class="qty-value" id="d-qty-value">30</span>
                            <button type="button" class="qty-btn" data-action="d-inc">＋</button>
                        </div>
                    </div>

                    <div class="ocr-scan-status" id="ocr-scan-status">성분표 사진을 스캔해서 자동으로 채워볼게요...</div>
                    <input type="text" class="detail-category-input" id="d-category" placeholder="카테고리 (예: 비타민, 오메가3)">
                    <input type="number" class="detail-category-input" id="d-percent" min="0" max="999" placeholder="하루 권장량 대비 % (예: 100)">
                    <input type="text" class="detail-category-input" id="d-amount" placeholder="실제 함유량 (예: 500mg)">
                    <textarea class="detail-desc-textarea" id="d-memo" placeholder="복용 방법이나 메모를 적어보세요"></textarea>

                    <button type="submit" class="detail-submit">내 영양제에 등록</button>
                </form>
            </div>
        `;
        host.appendChild(overlay);
        runLabelAutoScan(overlay);

        overlay.querySelectorAll(".detail-thumb").forEach((thumb) => {
            thumb.addEventListener("click", () => {
                overlay.querySelectorAll(".detail-thumb").forEach((t) => t.classList.remove("active"));
                thumb.classList.add("active");
                overlay.querySelector("#detail-hero-image").src = capturedPhotos[thumb.dataset.thumb].url;
            });
        });

        overlay.querySelector(".detail-back").addEventListener("click", () => {
            closeDetailOverlay();
            openCaptureOverlay();
        });

        overlay.querySelector("[data-close]").addEventListener("click", () => {
            resetCapturedPhotos();
            closeDetailOverlay();
        });

        overlay.querySelector('[data-action="d-dec"]').addEventListener("click", () => {
            draftQty = Math.max(0, draftQty - 1);
            overlay.querySelector("#d-qty-value").textContent = draftQty;
        });
        overlay.querySelector('[data-action="d-inc"]').addEventListener("click", () => {
            draftQty += 1;
            overlay.querySelector("#d-qty-value").textContent = draftQty;
        });

        overlay.querySelector("#detail-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = overlay.querySelector("#d-name").value.trim();
            if (!name) return;
            const category = overlay.querySelector("#d-category").value.trim();
            const dosage = overlay.querySelector("#d-dosage").value.trim() || "1";
            const unit = overlay.querySelector("#d-unit").value;
            const percent = overlay.querySelector("#d-percent").value.trim();
            const amount = overlay.querySelector("#d-amount").value.trim();
            const memo = overlay.querySelector("#d-memo").value.trim();

            // localStorage에 계속 남을 수 있도록 blob URL 대신 data URL(base64)로 변환
            const [photoDataUrl, labelDataUrl] = await Promise.all([
                fileToDataURL(capturedPhotos.product.file),
                fileToDataURL(capturedPhotos.label.file),
            ]);

            addMedicineCard({
                name,
                category,
                dosage,
                unit,
                quantity: draftQty,
                percent,
                amount,
                memo,
                photoUrl: photoDataUrl,
                labelPhotoUrl: labelDataUrl,
            });
            saveMedicinesToStorage();

            resetCapturedPhotos();
            closeDetailOverlay();
        });
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ---------- 성분표 사진 자동 스캔(OCR): Tesseract.js로 글자를 읽어서
    // 카테고리/퍼센트/함유량 입력칸을 미리 채워줌. 인식이 틀릴 수 있어서
    // 항상 사용자가 확인하고 고칠 수 있는 입력칸에 채우기만 함 ----------
    // fuzzy:true인 키워드만 한 글자 정도 다르게 읽혀도 찾아냄. 비타민A/C/D처럼 글자 하나로만
    // 구분되는 단어는 fuzzy를 켜면 서로 오인식되기 쉬워서 정확히 일치할 때만 인정함(fuzzy:false)
    const OCR_NUTRIENT_KEYWORDS = [
        { kw: "비타민D", label: "비타민D", fuzzy: false },
        { kw: "비타민 D", label: "비타민D", fuzzy: false },
        { kw: "비타민B12", label: "비타민B12", fuzzy: false },
        { kw: "비타민 B12", label: "비타민B12", fuzzy: false },
        { kw: "비타민A", label: "비타민A", fuzzy: false },
        { kw: "비타민 A", label: "비타민A", fuzzy: false },
        { kw: "비타민C", label: "비타민C", fuzzy: false },
        { kw: "비타민 C", label: "비타민C", fuzzy: false },
        { kw: "오메가3", label: "오메가3", fuzzy: true },
        { kw: "오메가 3", label: "오메가3", fuzzy: true },
        { kw: "마그네슘", label: "마그네슘", fuzzy: true },
        { kw: "프로바이오틱스", label: "프로바이오틱스", fuzzy: true },
        { kw: "유산균", label: "프로바이오틱스", fuzzy: true },
        { kw: "엽산", label: "엽산", fuzzy: false },
        { kw: "밀크씨슬", label: "밀크씨슬", fuzzy: true },
        { kw: "실리마린", label: "밀크씨슬", fuzzy: true },
        { kw: "블랙마카", label: "블랙마카", fuzzy: true },
        { kw: "마카", label: "블랙마카", fuzzy: false },
        { kw: "멀티비타민", label: "멀티비타민", fuzzy: true },
        { kw: "아연", label: "아연", fuzzy: false },
        { kw: "칼슘", label: "칼슘", fuzzy: false },
        { kw: "철분", label: "철분", fuzzy: false },
        { kw: "루테인", label: "루테인", fuzzy: true },
        { kw: "콜라겐", label: "콜라겐", fuzzy: true },
    ];

    // 사진 인식 특성상 글자가 종종 틀리게 읽혀서("마그네슘" → "마그베숄" 등)
    // fuzzy가 켜진 키워드는 한 글자 정도 다른 것까지 허용해 찾아냄
    function levenshteinDistance(a, b) {
        const dp = [];
        for (let i = 0; i <= a.length; i++) dp.push([i]);
        for (let j = 1; j <= b.length; j++) dp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                dp[i][j] =
                    a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
            }
        }
        return dp[a.length][b.length];
    }

    function containsKeyword(cleanedText, keyword, fuzzy) {
        const kw = keyword.replace(/[^가-힣a-zA-Z0-9]/g, "");
        if (!fuzzy || kw.length < 4) return cleanedText.indexOf(kw) !== -1;
        const maxDist = 1;
        for (let i = 0; i <= cleanedText.length - kw.length; i++) {
            if (levenshteinDistance(cleanedText.slice(i, i + kw.length), kw) <= maxDist) return true;
        }
        return false;
    }

    // 퍼센트/함유량 숫자는 성분표 표 안에 여러 개가 섞여 있어서(1회 섭취량, 총 내용량 등)
    // 어떤 숫자가 어떤 성분 것인지 사진만으로 정확히 짝짓기 어려움 - 잘못된 숫자를
    // 자신 있게 채워주는 것보다 카테고리(성분명)만 찾아주고 숫자는 직접 입력하게 둠
    function guessNutrientInfoFromText(text) {
        if (!text) return { category: "" };
        const cleanedText = text.replace(/[^가-힣a-zA-Z0-9]/g, "");

        const foundLabels = [];
        OCR_NUTRIENT_KEYWORDS.forEach(({ kw, label, fuzzy }) => {
            if (!containsKeyword(cleanedText, kw, fuzzy)) return;
            if (!foundLabels.includes(label)) foundLabels.push(label);
        });

        return { category: foundLabels.join(",") };
    }

    // 작은 글씨가 많은 성분표 사진은 확대만 해도 Tesseract 인식률이 올라가서
    // 인식 전에 캔버스로 2배 확대함 (색/대비를 억지로 바꾸면 라벨 디자인에 따라
    // 오히려 글자가 배경에 묻혀버리는 경우가 있어 확대만 함)
    function preprocessImageForOCR(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const scale = 2;
                const canvas = document.createElement("canvas");
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob || file), "image/png");
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }

    async function runLabelAutoScan(overlay) {
        const statusEl = overlay.querySelector("#ocr-scan-status");
        const categoryInput = overlay.querySelector("#d-category");
        if (!statusEl || !capturedPhotos.label) return;

        if (typeof Tesseract === "undefined") {
            statusEl.textContent = "자동 스캔을 불러오지 못했어요. 직접 입력해주세요.";
            statusEl.classList.add("ocr-scan-status-fail");
            setTimeout(() => statusEl.remove(), 2500);
            return;
        }

        statusEl.classList.add("scanning");
        categoryInput.disabled = true;

        try {
            const processedImage = await preprocessImageForOCR(capturedPhotos.label.file);
            const {
                data: { text },
            } = await Tesseract.recognize(processedImage, "kor+eng");

            if (!overlay.isConnected) return; // 스캔 중 사용자가 창을 닫은 경우

            const guess = guessNutrientInfoFromText(text);
            if (guess.category) categoryInput.value = guess.category;

            statusEl.classList.remove("scanning");
            if (guess.category) {
                statusEl.textContent = "성분표에서 이 성분을 찾았어요. 퍼센트·함유량은 직접 입력해주세요.";
            } else {
                statusEl.textContent = "자동으로 알아보지 못했어요. 직접 입력해주세요.";
                statusEl.classList.add("ocr-scan-status-fail");
            }
        } catch (err) {
            if (!overlay.isConnected) return;
            statusEl.textContent = "자동 스캔에 실패했어요. 직접 입력해주세요.";
            statusEl.classList.remove("scanning");
            statusEl.classList.add("ocr-scan-status-fail");
        } finally {
            if (overlay.isConnected) categoryInput.disabled = false;
        }
    }

    const TILE_BG_CLASSES = ["tile-bg-1", "tile-bg-2", "tile-bg-3"];

    function addMedicineCard({ name, category, dosage, unit, quantity, percent, amount, memo, photoUrl, labelPhotoUrl }) {
        const panel = document.querySelector(".panel-medicines");
        if (!panel) return;
        let grid = panel.querySelector(".medicine-grid");
        if (!grid) {
            grid = document.createElement("div");
            grid.className = "medicine-grid";
            panel.insertBefore(grid, panel.querySelector(".fab"));
        }

        const label = category || name;
        const bgClass = TILE_BG_CLASSES[grid.children.length % TILE_BG_CLASSES.length];

        const tile = document.createElement("div");
        tile.className = "medicine-tile";
        tile.dataset.name = name;
        tile.dataset.category = category || "";
        tile.dataset.dosage = dosage || "1";
        tile.dataset.unit = unit || "";
        tile.dataset.qty = quantity != null ? quantity : 0;
        tile.dataset.percent = percent || "";
        tile.dataset.amount = amount || "";
        tile.dataset.memo = memo || "";
        tile.dataset.labelPhoto = labelPhotoUrl || "";
        tile.innerHTML = `
            <div class="medicine-tile-photo ${photoUrl ? "" : bgClass}">
                ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(name)}">` : `<span class="medicine-tile-placeholder">💊</span>`}
            </div>
            <div class="medicine-tile-label">${escapeHtml(label)}</div>
        `;
        grid.appendChild(tile);
        updateMedicineCount();
    }

    // ---------- 내 영양제: localStorage에 저장/복원 ----------
    const MEDICINES_STORAGE_KEY = "gwangja_medicines_v1";

    function saveMedicinesToStorage() {
        const tiles = Array.from(document.querySelectorAll(".medicine-tile"));
        const data = tiles.map((t) => {
            const img = t.querySelector(".medicine-tile-photo img");
            return {
                name: t.dataset.name || "",
                category: t.dataset.category || "",
                dosage: t.dataset.dosage || "",
                unit: t.dataset.unit || "",
                qty: t.dataset.qty || "0",
                percent: t.dataset.percent || "",
                amount: t.dataset.amount || "",
                memo: t.dataset.memo || "",
                photoUrl: img ? img.src : "",
                labelPhoto: t.dataset.labelPhoto || "",
            };
        });
        try {
            localStorage.setItem(MEDICINES_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // 저장 용량 초과 등은 데모 앱 특성상 조용히 무시
        }
    }

    // 페이지 로드 시 1회 호출: localStorage에 저장된 게 있으면 그걸로 그리드를 다시 그리고,
    // 없으면(첫 방문) 지금 정적 HTML에 있는 타일들을 그대로 저장해서 앞으로도 유지되게 함
    function restoreMedicinesFromStorage() {
        let saved = null;
        try {
            const raw = localStorage.getItem(MEDICINES_STORAGE_KEY);
            saved = raw ? JSON.parse(raw) : null;
        } catch (e) {
            saved = null;
        }

        if (!saved) {
            saveMedicinesToStorage();
            return;
        }

        const panel = document.querySelector(".panel-medicines");
        const grid = panel ? panel.querySelector(".medicine-grid") : null;
        if (grid) grid.innerHTML = "";

        saved.forEach((m) => {
            addMedicineCard({
                name: m.name,
                category: m.category,
                dosage: m.dosage,
                unit: m.unit,
                quantity: Number(m.qty) || 0,
                percent: m.percent,
                amount: m.amount,
                memo: m.memo,
                photoUrl: m.photoUrl,
                labelPhotoUrl: m.labelPhoto,
            });
        });
    }

    function deleteMedicineTile(tile) {
        const name = tile.dataset.name || "";
        if (!confirm(`'${name}'을(를) 삭제할까요? 등록된 사진과 정보가 모두 사라져요.`)) return false;
        tile.remove();
        updateMedicineCount();
        saveMedicinesToStorage();
        return true;
    }

    function updateMedicineCount() {
        const panel = document.querySelector(".panel-medicines");
        if (!panel) return;
        const countEl = panel.querySelector(".section-title");
        if (countEl) countEl.textContent = `내 영양제 (${panel.querySelectorAll(".medicine-tile").length})`;
    }

    // ---------- 내 영양제 타일 클릭 → 상세페이지(hims 스타일) ----------
    function openMedicineDetailView(tile) {
        closeCaptureOverlay();
        closeDetailOverlay();
        const host = document.querySelector(".top") || document.body;

        const name = tile.dataset.name || "";
        const category = tile.dataset.category || "";
        const amount = tile.dataset.amount || "";
        const dosage = tile.dataset.dosage || "1";
        const unit = tile.dataset.unit || "";
        const expiry = tile.dataset.expiry || "";
        const memo = tile.dataset.memo || "";
        const labelPhoto = tile.dataset.labelPhoto || "";
        let qty = Number(tile.dataset.qty || 0);

        const photoImg = tile.querySelector(".medicine-tile-photo img");
        const photoUrl = photoImg ? photoImg.src : "";

        const heroPhoto = photoUrl || labelPhoto;

        const overlay = document.createElement("div");
        overlay.className = "detail-overlay";
        overlay.id = "detail-overlay";
        overlay.innerHTML = `
            <div class="detail-sheet">
                <div class="detail-hero">
                    <button type="button" class="detail-icon-btn detail-back" data-close><img class="detail-back-icon" src="images/icon-return.png" alt="뒤로"></button>
                    ${
                        heroPhoto
                            ? `<img class="detail-hero-image" id="detail-view-hero-image" src="${heroPhoto}" alt="${escapeHtml(name)}">`
                            : `<span class="detail-hero-placeholder">💊</span>`
                    }
                    ${
                        photoUrl && labelPhoto
                            ? `<div class="detail-thumbs">
                                <button type="button" class="detail-thumb active" data-thumb-src="${photoUrl}">
                                    <img src="${photoUrl}" alt="">
                                </button>
                                <button type="button" class="detail-thumb" data-thumb-src="${labelPhoto}">
                                    <img src="${labelPhoto}" alt="">
                                </button>
                               </div>`
                            : ""
                    }
                </div>
                <div class="detail-body">
                    <h2 class="detail-view-name">${escapeHtml(name)}</h2>
                    <div class="detail-category-badges">
                        ${parseAmountList(category, amount)
                            .map(
                                ({ label, amount: amt }, i) => `
                                <button type="button" class="detail-category-badge${amt ? "" : " no-amount"}" data-action="edit-amount" data-index="${i}">
                                    ${escapeHtml(label)}${amt ? ` ${escapeHtml(amt)}` : ` <span class="badge-add-amount">함량 입력</span>`}
                                </button>`
                            )
                            .join("")}
                    </div>

                    <div class="detail-field-label">복용 방법</div>
                    <div class="detail-sub-row"><span>1회 ${escapeHtml(dosage)}${escapeHtml(unit)} 복용</span></div>

                    <div class="detail-field-label">유통기한</div>
                    <button type="button" class="detail-sub-row detail-expiry-row" data-action="edit-expiry">
                        <span>${expiry ? escapeHtml(expiry) : '<span class="badge-add-amount">유통기한 입력</span>'}</span>
                    </button>

                    <div class="detail-qty-row boxed">
                        <div class="detail-qty-label">재고</div>
                        <div class="inv-qty-control">
                            <button type="button" class="qty-btn" data-action="v-dec">－</button>
                            <span class="qty-value" id="v-qty-value">${qty}</span>
                            <button type="button" class="qty-btn" data-action="v-inc">＋</button>
                        </div>
                    </div>

                    ${
                        memo
                            ? `<div class="detail-view-memo">
                                   <div class="detail-view-memo-title">기타 안내사항</div>
                                   <p>${escapeHtml(memo)}</p>
                               </div>`
                            : ""
                    }

                    <button type="button" class="detail-delete-btn" data-action="delete-medicine">이 영양제 삭제</button>
                </div>
            </div>
        `;
        host.appendChild(overlay);

        overlay.querySelectorAll(".detail-thumb").forEach((thumb) => {
            thumb.addEventListener("click", () => {
                overlay.querySelectorAll(".detail-thumb").forEach((t) => t.classList.remove("active"));
                thumb.classList.add("active");
                overlay.querySelector("#detail-view-hero-image").src = thumb.dataset.thumbSrc;
            });
        });

        overlay.querySelector("[data-close]").addEventListener("click", closeDetailOverlay);
        overlay.querySelector('[data-action="v-dec"]').addEventListener("click", () => {
            qty = Math.max(0, qty - 1);
            overlay.querySelector("#v-qty-value").textContent = qty;
            tile.dataset.qty = qty;
            saveMedicinesToStorage();
        });
        overlay.querySelector('[data-action="v-inc"]').addEventListener("click", () => {
            qty += 1;
            overlay.querySelector("#v-qty-value").textContent = qty;
            tile.dataset.qty = qty;
            saveMedicinesToStorage();
        });
        overlay.querySelector('[data-action="delete-medicine"]').addEventListener("click", () => {
            if (deleteMedicineTile(tile)) closeDetailOverlay();
        });

        overlay.querySelectorAll('[data-action="edit-amount"]').forEach((badge) => {
            badge.addEventListener("click", () => {
                const idx = Number(badge.dataset.index);
                const labels = (tile.dataset.category || "").split(",").map((s) => s.trim()).filter(Boolean);
                const amounts = (tile.dataset.amount || "").split(",").map((s) => s.trim());
                while (amounts.length < labels.length) amounts.push("");
                const input = window.prompt(`${labels[idx]} 함유량을 입력해주세요 (예: 500mg)`, amounts[idx] || "");
                if (input === null) return;
                amounts[idx] = input.trim();
                tile.dataset.amount = amounts.join(",");
                saveMedicinesToStorage();
                openMedicineDetailView(tile);
            });
        });

        overlay.querySelector('[data-action="edit-expiry"]').addEventListener("click", () => {
            const input = window.prompt("유통기한을 입력해주세요 (예: 2027-03-15)", tile.dataset.expiry || "");
            if (input === null) return;
            tile.dataset.expiry = input.trim();
            saveMedicinesToStorage();
            openMedicineDetailView(tile);
        });
    }

    // ---------- 오늘의 영양제: + 버튼 → 내 영양제 목록에서 골라 오늘 목록에 추가 ----------
    // 복용 체크 시 해당 영양소의 헤더 아래 섭취 그래프(boxGrap)를 채워줌
    // "마그네슘,비타민D" + "100,100" 처럼 콤마로 나열된 여러 성분을 병렬 목록으로 해석
    function parseNutrientList(categoryStr, percentStr) {
        const labels = (categoryStr || "").split(",").map((s) => s.trim()).filter(Boolean);
        const percents = (percentStr || "").split(",").map((s) => s.trim());
        return labels.map((label, i) => ({ label, percent: Number(percents[i]) || 0 }));
    }

    function parseAmountList(categoryStr, amountStr) {
        const labels = (categoryStr || "").split(",").map((s) => s.trim()).filter(Boolean);
        const amounts = (amountStr || "").split(",").map((s) => s.trim());
        return labels.map((label, i) => ({ label, amount: amounts[i] || "" }));
    }

    function applyNutrientIntake(categoryStr, percentStr, add) {
        parseNutrientList(categoryStr, percentStr).forEach(({ label, percent }) => {
            if (!percent) return;
            const source = NUTRIENT_SOURCES.find((nu) => nu.label === label);
            if (!source) return;
            document.querySelectorAll(`.nutrient-fill.${source.key}`).forEach((fillEl) => {
                const current = parseFloat(fillEl.style.height) || 0;
                const next = Math.max(0, current + (add ? percent : -percent));
                fillEl.style.height = `${next}%`;
            });
        });
        refreshNutritionAnalysis();
    }

    // 건강상태 탭의 링 그래프/과대·부족 리스트를 실제 캡슐 그래프 값 기준으로 다시 그림
    function refreshNutritionAnalysis() {
        const grid = document.getElementById("nutri-ring-grid");
        if (!grid) return;

        let total = 0;
        const overItems = [];
        const lowItems = [];

        NUTRIENT_SOURCES.forEach((nu) => {
            const fillEl = document.querySelector(`.nutrient-fill.${nu.key}`);
            const pct = fillEl ? parseFloat(fillEl.style.height) || 0 : 0;
            total += pct;

            const box = grid.querySelector(`[data-nutrient-key="${nu.key}"]`);
            if (box) {
                const ring = box.querySelector(".nutri-ring");
                const valueEl = box.querySelector(".nutri-ring-value");
                ring.style.setProperty("--pct", pct);
                ring.classList.toggle("over", pct > 100);
                ring.classList.toggle("low", pct < 50);
                valueEl.textContent = `${Math.round(pct)}%`;
            }

            if (pct > 100) overItems.push({ ...nu, pct });
            else if (pct < 50) lowItems.push({ ...nu, pct });
        });

        const avgEl = document.getElementById("nutri-rate-avg");
        if (avgEl) avgEl.textContent = `${Math.round(total / NUTRIENT_SOURCES.length)}%`;

        renderGapList("over", overItems);
        renderGapList("low", lowItems);
    }

    function renderGapList(kind, items) {
        const section = document.getElementById(kind === "over" ? "nutri-over-section" : "nutri-low-section");
        const list = document.getElementById(kind === "over" ? "nutri-over-list" : "nutri-low-list");
        if (!section || !list) return;

        section.hidden = items.length === 0;
        list.innerHTML = items
            .map((nu) => {
                const hint = NUTRITION_HINTS[nu.key] ? NUTRITION_HINTS[nu.key][kind] : "";
                return `
                <div class="card nutrient-gap-item ${kind === "over" ? "over" : ""}">
                    <div class="nutrient-gap-name"><span class="gap-warn-icon">⚠</span> ${escapeHtml(nu.label)} ${Math.round(nu.pct)}%</div>
                    <div class="nutrient-gap-hint">${escapeHtml(hint)}</div>
                </div>`;
            })
            .join("");
    }

    // 복용 체크 시 해당 영양제의 재고를 1씩 줄이고(취소하면 다시 늘림)
    function adjustStock(name, add) {
        const tile = Array.from(document.querySelectorAll(".medicine-tile")).find((t) => t.dataset.name === name);
        if (!tile) return;
        const current = Number(tile.dataset.qty || 0);
        const next = Math.max(0, current + (add ? 1 : -1));
        tile.dataset.qty = next;
    }

    function wireTodayCheck(btn) {
        btn.addEventListener("click", () => {
            const item = btn.closest(".today-item");
            if (item && item.classList.contains("show-remove")) {
                deleteTodayItem(item);
                return;
            }
            const checked = btn.classList.toggle("checked");
            const timeEl = btn.parentElement.querySelector(".today-check-time");
            const category = item ? item.dataset.category : "";
            const percent = item ? item.dataset.percent : "";
            const name = item ? item.querySelector(".today-item-name").textContent : "";

            applyNutrientIntake(category, percent, checked);
            adjustStock(name, !checked);

            if (timeEl) {
                if (checked) {
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, "0");
                    const mm = String(now.getMinutes()).padStart(2, "0");
                    timeEl.textContent = `${hh}:${mm}`;
                } else {
                    timeEl.textContent = "";
                }
            }
            saveTodayToStorage();
            saveMedicinesToStorage();
        });
    }

    function addTodayItem(name) {
        const list = document.querySelector(".today-list");
        if (!list) return;

        const tile = Array.from(document.querySelectorAll(".medicine-tile")).find((t) => t.dataset.name === name);
        const category = tile ? tile.dataset.category || "" : "";
        const percent = tile ? tile.dataset.percent || "" : "";

        const item = document.createElement("div");
        item.className = "today-item today-item-removable";
        item.dataset.category = category;
        item.dataset.percent = percent;
        item.innerHTML = `
            <span class="today-item-name">${escapeHtml(name)}</span>
            <div class="today-check-group">
                <span class="today-check-time"></span>
                <button type="button" class="today-check" aria-label="복용 체크">✓</button>
            </div>
        `;
        list.appendChild(item);
        wireTodayCheck(item.querySelector(".today-check"));
        wireLongPressDelete(item);

        const imgBox = document.querySelector(".today .imgBox");
        if (imgBox) imgBox.style.visibility = "hidden";

        saveTodayToStorage();
        return item;
    }

    // ---------- 오늘의 영양제: localStorage에 저장/복원 ----------
    const TODAY_STORAGE_KEY = "gwangja_today_v1";

    function saveTodayToStorage() {
        const items = Array.from(document.querySelectorAll(".today-item")).map((item) => ({
            name: item.querySelector(".today-item-name").textContent,
            checked: item.querySelector(".today-check").classList.contains("checked"),
            time: item.querySelector(".today-check-time").textContent || "",
            removable: item.classList.contains("today-item-removable"),
        }));
        try {
            localStorage.setItem(TODAY_STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            // 저장 용량 초과 등은 데모 앱 특성상 조용히 무시
        }
    }

    // 페이지 로드 시 1회 호출: 고정 항목(탈모약/한약)은 체크 상태만 복원하고,
    // 새로 추가했던 항목은 다시 만든 뒤 체크 상태를 복원함. 재고는 이미 영양제 타일에
    // 저장돼 있으므로 다시 차감하지 않고, 영양소 그래프만 체크된 항목 기준으로 다시 채움
    function restoreTodayFromStorage() {
        let saved = null;
        try {
            const raw = localStorage.getItem(TODAY_STORAGE_KEY);
            saved = raw ? JSON.parse(raw) : null;
        } catch (e) {
            saved = null;
        }
        if (!saved) return;

        saved.forEach((s) => {
            let item;
            if (s.removable) {
                item = addTodayItem(s.name);
            } else {
                item = Array.from(document.querySelectorAll(".today-item")).find(
                    (el) => !el.classList.contains("today-item-removable") && el.querySelector(".today-item-name").textContent === s.name
                );
            }
            if (item && s.checked) {
                item.querySelector(".today-check").classList.add("checked");
                item.querySelector(".today-check-time").textContent = s.time;
            }
        });

        document.querySelectorAll(".today-item").forEach((item) => {
            if (item.querySelector(".today-check").classList.contains("checked")) {
                applyNutrientIntake(item.dataset.category, item.dataset.percent, true);
            }
        });
    }

    function isAlreadyInTodayList(name) {
        return Array.from(document.querySelectorAll(".today-item-name")).some((el) => el.textContent === name);
    }

    function renderRecResults(condition) {
        const resultsEl = document.getElementById("rec-results");
        if (!resultsEl) return;

        const nutrients = RECOMMENDATIONS[condition];
        if (!nutrients) {
            resultsEl.innerHTML = "";
            return;
        }

        const tiles = Array.from(document.querySelectorAll(".medicine-tile"));

        const rowsHtml = nutrients
            .map((nutrient) => {
                const owned = tiles.filter((t) =>
                    parseNutrientList(t.dataset.category, t.dataset.percent).some((n) => n.label === nutrient)
                );
                if (owned.length === 0) {
                    return `
                    <div class="card rec-item-top">
                        <span class="rec-name">${escapeHtml(nutrient)}</span>
                        <span class="rec-status muted">등록된 제품 없음</span>
                    </div>`;
                }
                return owned
                    .map((tile) => {
                        const productName = tile.dataset.name || "";
                        const added = isAlreadyInTodayList(productName);
                        return `
                        <div class="card rec-item-top">
                            <span class="rec-name">${escapeHtml(productName)} <span class="rec-nutrient-tag">${escapeHtml(nutrient)}</span></span>
                            ${
                                added
                                    ? `<span class="rec-status safe">✓ 추가됨</span>`
                                    : `<button type="button" class="rec-add-btn" data-add-name="${escapeHtml(productName)}">+</button>`
                            }
                        </div>`;
                    })
                    .join("");
            })
            .join("");

        resultsEl.innerHTML = rowsHtml;

        resultsEl.querySelectorAll("[data-add-name]").forEach((btn) => {
            btn.addEventListener("click", () => {
                addTodayItem(btn.dataset.addName);
                renderRecResults(condition);
            });
        });
    }

    function wireConditionButtons() {
        document.querySelectorAll(".today .button button[data-condition]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const isActive = btn.classList.contains("active");
                document.querySelectorAll(".today .button button[data-condition]").forEach((b) => b.classList.remove("active"));

                if (isActive) {
                    renderRecResults(null);
                    return;
                }
                btn.classList.add("active");
                renderRecResults(btn.dataset.condition);
            });
        });
    }

    // ---------- 건강상태: 영양소 필터 pill ↔ 차트 막대 하이라이트 ----------
    function wireNutrientPills() {
        document.querySelectorAll(".nutri-pill").forEach((pill) => {
            pill.addEventListener("click", () => {
                const nutrient = pill.dataset.nutrient;

                document.querySelectorAll(".nutri-pill").forEach((p) => p.classList.toggle("active", p === pill));
                document.querySelectorAll(".nutrient-bar-fill").forEach((fill) => {
                    const bar = fill.closest(".nutrient-bar");
                    fill.classList.toggle("active", bar && bar.dataset.nutrient === nutrient);
                });
            });
        });
    }

    // ---------- 건강상태: 주차 이동 (표시용, 실제 데이터는 바뀌지 않음) ----------
    function wireWeekNav() {
        const titleEl = document.getElementById("nutri-week-title");
        if (!titleEl) return;
        let week = 2;

        function render() {
            titleEl.textContent = `9월 ${week}주차`;
        }

        document.querySelector('[data-action="week-prev"]').addEventListener("click", () => {
            week = week <= 1 ? 4 : week - 1;
            render();
        });
        document.querySelector('[data-action="week-next"]').addEventListener("click", () => {
            week = week >= 4 ? 1 : week + 1;
            render();
        });
    }

    function deleteTodayItem(item) {
        const name = item.querySelector(".today-item-name").textContent;
        if (!confirm(`'${name}'을(를) 오늘의 영양제 목록에서 삭제할까요?`)) {
            exitDeleteMode(item);
            return;
        }
        if (item.querySelector(".today-check").classList.contains("checked")) {
            applyNutrientIntake(item.dataset.category, item.dataset.percent, false);
        }
        item.remove();

        const remaining = document.querySelectorAll(".today-item-removable").length;
        const imgBox = document.querySelector(".today .imgBox");
        if (remaining === 0 && imgBox) imgBox.style.visibility = "visible";

        saveTodayToStorage();
    }

    function exitDeleteMode(item) {
        item.classList.remove("show-remove");
        const checkBtn = item.querySelector(".today-check");
        if (checkBtn) checkBtn.textContent = "✓";
    }

    function wireLongPressDelete(item) {
        const LONG_PRESS_MS = 500;
        let pressTimer = null;
        const checkBtn = item.querySelector(".today-check");

        item.addEventListener("pointerdown", () => {
            pressTimer = setTimeout(() => {
                item.classList.add("show-remove");
                checkBtn.textContent = "✕";
            }, LONG_PRESS_MS);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
            item.addEventListener(evt, () => clearTimeout(pressTimer));
        });

        document.addEventListener("pointerdown", (e) => {
            if (!item.contains(e.target)) exitDeleteMode(item);
        });
    }

    function closeTodayPickerOverlay() {
        const el = document.getElementById("today-picker-overlay");
        if (el) el.remove();
    }

    function openTodayPickerOverlay() {
        closeTodayPickerOverlay();
        const host = document.querySelector(".top") || document.body;
        const tiles = Array.from(document.querySelectorAll(".medicine-tile"));

        function renderRows(keyword) {
            const kw = (keyword || "").trim().toLowerCase();
            const filtered = tiles.filter((t) => (t.dataset.name || "").toLowerCase().includes(kw));
            if (filtered.length === 0) {
                return `<div class="picker-empty">${kw ? "검색 결과가 없어요" : "등록된 영양제가 없어요. '영양제' 탭에서 먼저 등록해 주세요."}</div>`;
            }
            return filtered
                .map((t) => {
                    const img = t.querySelector(".medicine-tile-photo img");
                    const photoUrl = img ? img.src : "";
                    const bgClass = photoUrl
                        ? ""
                        : (t.querySelector(".medicine-tile-photo").className.split(" ").find((c) => c.startsWith("tile-bg-")) || "");
                    const name = t.dataset.name || "";
                    const percent = t.dataset.percent;
                    const amount = t.dataset.amount;
                    return `
                    <button type="button" class="picker-row" data-name="${escapeHtml(name)}">
                        <span class="picker-row-photo ${bgClass}">
                            ${photoUrl ? `<img src="${photoUrl}" alt="">` : `<span class="medicine-tile-placeholder">💊</span>`}
                        </span>
                        <span class="picker-row-name">${escapeHtml(name)}</span>
                        ${
                            percent
                                ? `<span class="picker-row-meta">
                                    <span class="picker-row-percent">${escapeHtml(percent)}%</span>
                                    ${amount ? `<span class="picker-row-amount">${escapeHtml(amount)}</span>` : ""}
                                </span>`
                                : ""
                        }
                    </button>`;
                })
                .join("");
        }

        const overlay = document.createElement("div");
        overlay.className = "capture-overlay";
        overlay.id = "today-picker-overlay";
        overlay.innerHTML = `
            <div class="capture-sheet">
                <div class="capture-header">
                    <span>오늘 먹을 영양제 추가</span>
                    <button type="button" class="capture-close" data-close>✕</button>
                </div>
                <input type="text" class="picker-search" id="picker-search" placeholder="영양제 이름 검색">
                <div class="picker-list" id="picker-list">${renderRows("")}</div>
            </div>
        `;
        host.appendChild(overlay);

        function wireRows() {
            overlay.querySelectorAll(".picker-row").forEach((row) => {
                row.addEventListener("click", () => {
                    addTodayItem(row.dataset.name);
                    closeTodayPickerOverlay();
                });
            });
        }
        wireRows();

        overlay.querySelector("#picker-search").addEventListener("input", (e) => {
            overlay.querySelector("#picker-list").innerHTML = renderRows(e.target.value);
            wireRows();
        });

        overlay.querySelector("[data-close]").addEventListener("click", closeTodayPickerOverlay);
    }

    function init() {
        renderCalendar();
        const boxGrap = document.querySelector(".boxGrap");
        if (boxGrap) boxGrap.addEventListener("click", handleBoxGrapClick);

        showRandomWaitingMascot();
        const homeMenuRadio = document.getElementById("menu-home");
        if (homeMenuRadio) homeMenuRadio.addEventListener("change", showRandomWaitingMascot);

        restoreMedicinesFromStorage();

        wireConditionButtons();
        updateMedicineCount();
        wireNutrientPills();
        wireWeekNav();
        refreshNutritionAnalysis();

        const homeFab = document.querySelector(".panel-home .fab");
        if (homeFab) {
            homeFab.setAttribute("title", "오늘 먹을 영양제 추가");
            homeFab.addEventListener("click", openTodayPickerOverlay);
        }
        const medicinesFab = document.querySelector(".panel-medicines .fab");
        if (medicinesFab) {
            medicinesFab.setAttribute("title", "영양제 등록");
            medicinesFab.addEventListener("click", openCaptureOverlay);
        }

        const medicinesPanel = document.querySelector(".panel-medicines");
        if (medicinesPanel) {
            medicinesPanel.addEventListener("click", (e) => {
                const tile = e.target.closest(".medicine-tile");
                if (tile) openMedicineDetailView(tile);
            });
        }

        document.querySelectorAll(".today-check").forEach(wireTodayCheck);
        restoreTodayFromStorage();
        refreshNutritionAnalysis();

        checkReminders();
        setInterval(checkReminders, 30000);

        maybeShowPushPermissionModal();
        if ("Notification" in window && Notification.permission === "granted" && !localStorage.getItem(PUSH_SCHEDULED_KEY)) {
            setupGeneralServerPushReminders();
        }
        wirePushToggle();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // 홈 화면에 앱처럼 설치할 수 있도록(PWA) 서비스 워커 등록. 오프라인 캐싱만 담당하고,
    // 서버에서 보내는 푸시 알림 기능은 아직 없음(잠금화면 알림은 이 탭이 열려있을 때만 동작)
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("service-worker.js").catch(() => {});
        });
    }
})();
