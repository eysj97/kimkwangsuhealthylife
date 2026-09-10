(function () {
    "use strict";

    // 이 스크립트는 초록색 영역(주간 캘린더 + 영양소 캡슐 그래프)과
    // "오늘의 영양제" 빈 상태 마스코트 애니메이션을 담당합니다.
    // 나머지 화면은 여전히 정적 HTML/CSS입니다.

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
            key: "zinc",
            label: "아연",
            info: "면역 세포가 제 기능을 하도록 돕고,<br> 상처 회복과 세포 분열에도 관여해요.",
        },
        {
            key: "folatE",
            label: "엽산",
            info: "세포 분열과 혈액 생성에 필요한 비타민B군의 하나로, 특히 임신 중 태아 발달에 중요한 역할을 해요.",
        },
    ];

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
            day.classList.remove("selected", "dist-1", "dist-2", "dist-3");
            if (dist === 0) day.classList.add("selected");
            else if (dist <= 3) day.classList.add("dist-" + dist);
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
        { hour: 11, minute: 0, files: WAITING_IMAGE_GROUPS[0].files },
        { hour: 14, minute: 0, files: WAITING_IMAGE_GROUPS[1].files },
        { hour: 2, minute: 0, files: WAITING_IMAGE_GROUPS[2].files },
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
                    <button type="button" class="detail-icon-btn detail-back" data-action="detail-back">←</button>
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

                    <input type="text" class="detail-category-input" id="d-category" placeholder="카테고리 (예: 비타민, 오메가3)">
                    <input type="number" class="detail-category-input" id="d-percent" min="0" max="999" placeholder="하루 권장량 대비 % (예: 100)">
                    <input type="text" class="detail-category-input" id="d-amount" placeholder="실제 함유량 (예: 500mg)">
                    <textarea class="detail-desc-textarea" id="d-memo" placeholder="복용 방법이나 메모를 적어보세요"></textarea>

                    <button type="submit" class="detail-submit">내 영양제에 등록</button>
                </form>
            </div>
        `;
        host.appendChild(overlay);

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

        overlay.querySelector("#detail-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const name = overlay.querySelector("#d-name").value.trim();
            if (!name) return;
            const category = overlay.querySelector("#d-category").value.trim();
            const dosage = overlay.querySelector("#d-dosage").value.trim() || "1";
            const unit = overlay.querySelector("#d-unit").value;
            const percent = overlay.querySelector("#d-percent").value.trim();
            const amount = overlay.querySelector("#d-amount").value.trim();
            const memo = overlay.querySelector("#d-memo").value.trim();

            addMedicineCard({ name, category, dosage, unit, quantity: draftQty, percent, amount, memo, photoUrl: capturedPhotos.product.url });

            // 성공 경로: product.url은 방금 만든 타일의 <img>가 계속 쓰므로 revoke하지 않고 참조만 비움
            if (capturedPhotos.label) URL.revokeObjectURL(capturedPhotos.label.url);
            capturedPhotos = { product: null, label: null };
            closeDetailOverlay();
        });
    }

    const TILE_BG_CLASSES = ["tile-bg-1", "tile-bg-2", "tile-bg-3"];

    function addMedicineCard({ name, category, dosage, unit, quantity, percent, amount, memo, photoUrl }) {
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
        tile.innerHTML = `
            <div class="medicine-tile-photo ${photoUrl ? "" : bgClass}">
                ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(name)}">` : `<span class="medicine-tile-placeholder">💊</span>`}
            </div>
            <div class="medicine-tile-label">${escapeHtml(label)}</div>
        `;
        grid.appendChild(tile);

        const countEl = panel.querySelector(".section-title");
        if (countEl) countEl.textContent = `내 영양제 (${grid.querySelectorAll(".medicine-tile").length})`;
    }

    // ---------- 내 영양제 타일 클릭 → 상세페이지(hims 스타일) ----------
    function openMedicineDetailView(tile) {
        closeCaptureOverlay();
        closeDetailOverlay();
        const host = document.querySelector(".top") || document.body;

        const name = tile.dataset.name || "";
        const category = tile.dataset.category || "";
        const dosage = tile.dataset.dosage || "1";
        const unit = tile.dataset.unit || "";
        const memo = tile.dataset.memo || "";
        let qty = Number(tile.dataset.qty || 0);

        const photoImg = tile.querySelector(".medicine-tile-photo img");
        const photoUrl = photoImg ? photoImg.src : "";

        const overlay = document.createElement("div");
        overlay.className = "detail-overlay";
        overlay.id = "detail-overlay";
        overlay.innerHTML = `
            <div class="detail-sheet">
                <div class="detail-hero">
                    <button type="button" class="detail-icon-btn detail-back" data-close>←</button>
                    ${
                        photoUrl
                            ? `<img class="detail-hero-image" src="${photoUrl}" alt="${escapeHtml(name)}">`
                            : `<span class="detail-hero-placeholder">💊</span>`
                    }
                </div>
                <div class="detail-body">
                    <h2 class="detail-view-name">${escapeHtml(name)}</h2>
                    <div class="detail-sub-row"><span>1회 ${escapeHtml(dosage)}${escapeHtml(unit)} 복용</span></div>

                    <div class="detail-qty-row">
                        <div class="detail-qty-label">현재 재고</div>
                        <div class="inv-qty-control">
                            <button type="button" class="qty-btn" data-action="v-dec">－</button>
                            <span class="qty-value" id="v-qty-value">${qty}</span>
                            <button type="button" class="qty-btn" data-action="v-inc">＋</button>
                        </div>
                    </div>

                    ${category ? `<div class="detail-category-badge">${escapeHtml(category)}</div>` : ""}
                    ${memo ? `<p class="detail-view-memo">${escapeHtml(memo)}</p>` : ""}
                </div>
            </div>
        `;
        host.appendChild(overlay);

        overlay.querySelector("[data-close]").addEventListener("click", closeDetailOverlay);
        overlay.querySelector('[data-action="v-dec"]').addEventListener("click", () => {
            qty = Math.max(0, qty - 1);
            overlay.querySelector("#v-qty-value").textContent = qty;
            tile.dataset.qty = qty;
        });
        overlay.querySelector('[data-action="v-inc"]').addEventListener("click", () => {
            qty += 1;
            overlay.querySelector("#v-qty-value").textContent = qty;
            tile.dataset.qty = qty;
        });
    }

    // ---------- 오늘의 영양제: + 버튼 → 내 영양제 목록에서 골라 오늘 목록에 추가 ----------
    function wireTodayCheck(btn) {
        btn.addEventListener("click", () => {
            const checked = btn.classList.toggle("checked");
            const timeEl = btn.parentElement.querySelector(".today-check-time");
            if (!timeEl) return;
            if (checked) {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, "0");
                const mm = String(now.getMinutes()).padStart(2, "0");
                timeEl.textContent = `${hh}:${mm}`;
            } else {
                timeEl.textContent = "";
            }
        });
    }

    function addTodayItem(name) {
        const list = document.querySelector(".today-list");
        if (!list) return;
        const item = document.createElement("div");
        item.className = "today-item";
        item.innerHTML = `
            <button type="button" class="today-item-remove" aria-label="삭제">✕</button>
            <span class="today-item-name">${escapeHtml(name)}</span>
            <div class="today-check-group">
                <span class="today-check-time"></span>
                <button type="button" class="today-check" aria-label="복용 체크">✓</button>
            </div>
        `;
        list.appendChild(item);
        wireTodayCheck(item.querySelector(".today-check"));
        wireLongPressDelete(item, name);

        const imgBox = document.querySelector(".today .imgBox");
        if (imgBox) imgBox.style.display = "none";
    }

    function wireLongPressDelete(item, name) {
        const LONG_PRESS_MS = 500;
        let pressTimer = null;

        item.addEventListener("pointerdown", () => {
            pressTimer = setTimeout(() => item.classList.add("show-remove"), LONG_PRESS_MS);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
            item.addEventListener(evt, () => clearTimeout(pressTimer));
        });

        item.querySelector(".today-item-remove").addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`'${name}'을(를) 오늘의 영양제 목록에서 삭제할까요?`)) {
                item.remove();
            }
        });

        document.addEventListener("pointerdown", (e) => {
            if (!item.contains(e.target)) item.classList.remove("show-remove");
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

        checkReminders();
        setInterval(checkReminders, 30000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
