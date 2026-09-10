(function () {
    "use strict";

    // ---------- 저장소 ----------
    const STORAGE_KEY = "pt_medicines";
    const INTAKE_KEY_PREFIX = "pt_intake_";

    function loadMedicines() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveMedicines(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    // 로컬 기준 YYYY-MM-DD (toISOString은 절대 쓰지 말 것 — UTC로 먼저 변환되면서
    // 한국시간(KST) 등 UTC가 아닌 시간대에서는 날짜가 하루 밀릴 수 있음)
    function toDateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function todayStr() {
        return toDateStr(new Date());
    }

    function loadIntake(dateStr) {
        try {
            return JSON.parse(localStorage.getItem(INTAKE_KEY_PREFIX + dateStr)) || {};
        } catch (e) {
            return {};
        }
    }

    function saveIntake(dateStr, data) {
        localStorage.setItem(INTAKE_KEY_PREFIX + dateStr, JSON.stringify(data));
    }

    // ---------- 즉석 추가 항목 ("오늘만" 기록되는, 반복 스케줄과 무관한 항목) ----------
    const ADHOC_KEY_PREFIX = "pt_adhoc_";

    function loadAdhoc(dateStr) {
        try {
            return JSON.parse(localStorage.getItem(ADHOC_KEY_PREFIX + dateStr)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveAdhoc(dateStr, list) {
        localStorage.setItem(ADHOC_KEY_PREFIX + dateStr, JSON.stringify(list));
    }

    function addAdhocItem(dateStr, name) {
        const trimmed = (name || "").trim();
        if (!trimmed) return;
        const list = loadAdhoc(dateStr);
        list.push({ id: uid(), name: trimmed, status: "pending" });
        saveAdhoc(dateStr, list);
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ---------- 데모용 상호작용 데이터 ----------
    // 실제 서비스에서는 식약청/약사 검수를 거친 DB로 교체해야 함 (기획서 6장 참고)
    const INTERACTIONS = [
        { keywords: ["아스피린", "오메가3"], level: "MODERATE", desc: "혈액 응고를 늦추는 효과가 중복되어 출혈 위험이 높아질 수 있습니다.", rec: "복용량 조절이 필요할 수 있으니 의사·약사와 상담하세요." },
        { keywords: ["칼슘", "철분"], level: "MODERATE", desc: "칼슘이 철분의 체내 흡수를 방해할 수 있습니다.", rec: "두 성분은 2시간 이상 간격을 두고 복용하세요." },
        { keywords: ["와파린", "비타민k"], level: "CONTRAINDICATED", desc: "비타민K가 와파린의 항응고 효과를 크게 저하시킬 수 있습니다.", rec: "함께 복용하지 말고 반드시 의사와 상담하세요." },
        { keywords: ["혈압약", "감기약"], level: "HIGH", desc: "일부 감기약 성분이 혈압을 상승시켜 혈압약 효과를 방해할 수 있습니다.", rec: "복용 전 반드시 약사에게 성분을 확인하세요." },
        { keywords: ["아연", "항생제"], level: "MODERATE", desc: "아연이 일부 항생제의 흡수를 감소시킬 수 있습니다.", rec: "2시간 이상 간격을 두고 복용하세요." },
        { keywords: ["마그네슘", "항생제"], level: "MODERATE", desc: "마그네슘이 일부 항생제의 흡수를 감소시킬 수 있습니다.", rec: "2시간 이상 간격을 두고 복용하세요." },
    ];

    const RISK_LABEL = { LOW: "낮음", MODERATE: "주의", HIGH: "경고", CONTRAINDICATED: "금지" };

    // 약물 이름 두 개 사이의 규칙 매칭 (순서 무관, 키워드/부분일치 기반)
    function pairInteractions(nameA, nameB) {
        const nA = (nameA || "").toLowerCase();
        const nB = (nameB || "").toLowerCase();
        return INTERACTIONS.filter((rule) => {
            const [k1, k2] = rule.keywords;
            return (nA.includes(k1) && nB.includes(k2)) || (nA.includes(k2) && nB.includes(k1));
        });
    }

    // ---------- 데모용 상태별 추천 데이터 ----------
    // 실제 서비스에서는 전문가 검수를 거친 추천 데이터로 교체해야 함 (기획서 2.4, 6장 참고)
    const RECOMMENDATIONS = [
        { condition: "감기", items: ["비타민C", "아연"] },
        { condition: "몸살", items: ["비타민C", "마그네슘"] },
        { condition: "소화불량/설사·배탈", items: ["프로바이오틱스", "소화효소제"] },
        { condition: "피로", items: ["비타민B군", "마그네슘"] },
        { condition: "불면", items: ["마그네슘", "테아닌"] },
        { condition: "관절 통증", items: ["오메가3", "글루코사민"] },
    ];

    const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

    // ---------- 상태 ----------
    let currentView = "home";
    let openForm = null; // 수정 중인 약물 id, 또는 "new", 또는 null
    let selectedCondition = "";
    let selectedDate = todayStr(); // 홈 스케줄/캘린더에 표시·체크되는 날짜

    const appEl = document.querySelector(".top");
    const root = document.getElementById("view-root");
    const tabButtons = document.querySelectorAll(".menu[data-view]");

    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            currentView = btn.dataset.view;
            openForm = null;
            draftMed = null;
            render();
        });
    });

    // ---------- 화면 렌더링 분기 ----------
    function render() {
        const existingOverlay = document.getElementById("med-form-overlay");
        if (existingOverlay) existingOverlay.remove();
        const existingAlert = document.getElementById("interaction-alert-overlay");
        if (existingAlert) existingAlert.remove();

        tabButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.view === currentView);
        });

        if (currentView === "home") root.innerHTML = renderHome();
        else if (currentView === "medicines") root.innerHTML = renderMedicines();
        else if (currentView === "nutrition") root.innerHTML = renderNutrition();

        if (openForm !== null && currentView === "medicines") {
            renderMedicineForm(openForm);
        }

        attachEvents();
    }

    // ---------- 홈 ----------
    function getWeekDatesFor(dateStr) {
        const ref = new Date(dateStr + "T00:00:00");
        const sunday = new Date(ref);
        sunday.setDate(ref.getDate() - ref.getDay());
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sunday);
            d.setDate(sunday.getDate() + i);
            dates.push(d);
        }
        return dates;
    }

    function formatDateLabel(dateStr) {
        const d = new Date(dateStr + "T00:00:00");
        const label = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
        return dateStr === todayStr() ? `오늘 · ${label}` : label;
    }

    function renderWeekCalendar() {
        const dates = getWeekDatesFor(selectedDate);
        const todayStrVal = todayStr();
        const selDate = new Date(selectedDate + "T00:00:00");

        const cells = dates
            .map((d) => {
                const dateStr = toDateStr(d);
                const isToday = dateStr === todayStrVal;
                const isSelected = dateStr === selectedDate;
                const label = isToday ? "오늘" : DAY_LABELS[d.getDay()];
                return `
                <button type="button" class="calendar-day ${isSelected ? "selected" : ""}" data-action="select-date" data-date="${dateStr}">${label}</button>`;
            })
            .join("");

        return `
            <div class="calendar-card">
                <div class="calendar-week">
                    <button type="button" class="calendar-nav-btn" data-action="prev-week">‹</button>
                    ${cells}
                    <button type="button" class="calendar-nav-btn" data-action="next-week">›</button>
                </div>
                <div class="calendar-date-caption">${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${DAY_LABELS[selDate.getDay()]})</div>
            </div>
        `;
    }

    function renderScheduleItem(entry) {
        return `
            <div class="card schedule-item" data-key="${entry.key}">
                <div class="schedule-time">${entry.time || "추가"}</div>
                <div class="schedule-info">
                    <div class="med-name">${escapeHtml(entry.name)}</div>
                    <div class="med-dosage">${escapeHtml(entry.dosage || "")} ${escapeHtml(entry.unit || "")}</div>
                </div>
                <div class="schedule-actions">
                    ${
                        entry.status === "pending"
                            ? `<button class="btn-chip" data-action="skip" data-key="${entry.key}">건너뜀</button>
                               <button class="btn-chip taken" data-action="take" data-key="${entry.key}">복용완료</button>`
                            : `<span class="status-badge ${entry.status}">${entry.status === "taken" ? "복용함" : "건너뜀"}</span>
                               <button class="btn-chip" data-action="reset" data-key="${entry.key}">취소</button>`
                    }
                    ${entry.deletable ? `<button class="icon-btn" data-action="delete-adhoc" data-key="${entry.key}">✕</button>` : ""}
                </div>
            </div>`;
    }

    function renderHome() {
        const medicines = loadMedicines();
        const intake = loadIntake(selectedDate);
        const adhocItems = loadAdhoc(selectedDate);

        const entries = [];
        medicines.forEach((med) => {
            (med.times || []).forEach((t) => {
                const key = med.id + "_" + t;
                entries.push({
                    key,
                    name: med.name,
                    dosage: med.dosage,
                    unit: med.unit,
                    time: t,
                    status: intake[key] || "pending",
                    deletable: false,
                });
            });
        });
        entries.sort((a, b) => a.time.localeCompare(b.time));
        adhocItems.forEach((item) => {
            entries.push({
                key: "adhoc:" + item.id,
                name: item.name,
                dosage: "",
                unit: "",
                time: "",
                status: item.status,
                deletable: true,
            });
        });

        let scheduleHtml = "";
        if (entries.length === 0) {
            scheduleHtml = '<div class="empty-state">추가된 복용 항목이 없습니다.<br>아래에서 오늘 먹을 것을 추가하거나, "약물" 탭에서 매일 복용할 약을 등록해 보세요.</div>';
        } else {
            scheduleHtml = entries.map(renderScheduleItem).join("");
        }
        scheduleHtml += `
            <form id="adhoc-add-form" class="adhoc-add-row">
                <input type="text" id="adhoc-name-input" placeholder="오늘 먹을 것 추가 (예: 유산균)">
                <button type="submit" class="btn-chip taken">추가</button>
            </form>
        `;

        return `
            ${renderWeekCalendar()}

            <div class="disclaimer">본 앱의 정보는 참고용입니다. 실제 복용 결정은 반드시 의사·약사와 상담하세요.</div>

            <div class="section-title">${formatDateLabel(selectedDate)} 복용 스케줄</div>
            ${scheduleHtml}

            <div class="section-title">상태별 영양제 추천</div>
            <div class="card">
                <select class="condition-select" data-change-action="set-condition">
                    <option value="">증상/상태를 선택하세요</option>
                    ${RECOMMENDATIONS.map(
                        (r) => `<option value="${escapeAttr(r.condition)}" ${selectedCondition === r.condition ? "selected" : ""}>${escapeHtml(r.condition)}</option>`
                    ).join("")}
                </select>
            </div>
            ${renderRecommendationResults(medicines)}
        `;
    }

    function renderRecommendationResults(medicines) {
        if (!selectedCondition) return "";
        const rec = RECOMMENDATIONS.find((r) => r.condition === selectedCondition);
        if (!rec) return "";

        const todaysAdhoc = loadAdhoc(selectedDate);
        const dateLabel = selectedDate === todayStr() ? "오늘" : "선택일";

        const itemsHtml = rec.items
            .map((item) => {
                const conflicts = [];
                medicines.forEach((m) => {
                    pairInteractions(item, m.name).forEach((rule) => conflicts.push({ with: m.name, ...rule }));
                });
                const isSafe = conflicts.length === 0;
                const alreadyAdded = todaysAdhoc.some((a) => a.name === item);
                return `
                <div class="card rec-item">
                    <div class="rec-item-top">
                        <span class="rec-name">${escapeHtml(item)}</span>
                        <span class="rec-status ${isSafe ? "safe" : "warn"}">${isSafe ? "✓ 복용 가능" : "⚠ 주의"}</span>
                    </div>
                    ${conflicts
                        .map(
                            (c) => `<div class="rec-conflict">${escapeHtml(c.with)}와(과): ${escapeHtml(c.desc)}</div>`
                        )
                        .join("")}
                    ${
                        alreadyAdded
                            ? `<div class="rec-added">✓ ${dateLabel} 목록에 추가됨</div>`
                            : `<button type="button" class="link-btn" data-action="add-rec-to-today" data-name="${escapeAttr(item)}">+ ${dateLabel} 목록에 추가</button>`
                    }
                </div>`;
            })
            .join("");

        return `
            <div class="section-title">"${escapeHtml(selectedCondition)}"에 도움이 될 수 있는 영양제</div>
            ${itemsHtml}
            <div class="disclaimer">추천 정보는 데모용 샘플 데이터입니다. 실제 복용 전 의사·약사와 상담하세요.</div>
        `;
    }

    // ---------- 약물 (등록 정보 + 재고 통합) ----------
    function renderMedicines() {
        const medicines = loadMedicines();

        let listHtml = "";
        if (medicines.length === 0) {
            listHtml = '<div class="empty-state">등록된 약물이 없습니다.<br>오른쪽 아래 + 버튼으로 추가해 보세요.</div>';
        } else {
            listHtml = medicines
                .map((m) => {
                    const perDay = (m.times || []).length || 1;
                    const daysLeft = Math.floor(Number(m.quantity) / perDay);
                    const isLow = Number(m.quantity) <= Number(m.threshold);
                    return `
                <div class="card medicine-card ${isLow ? "low" : ""}">
                    <div class="med-top">
                        <div>
                            <div class="med-name">${escapeHtml(m.name)}</div>
                            <div class="med-meta">
                                <span>${escapeHtml(m.dosage || "")} ${escapeHtml(m.unit || "")}</span>
                                <span>${(m.times || []).join(", ") || "시간 미설정"}</span>
                            </div>
                        </div>
                        <div>
                            <button class="icon-btn" data-action="edit-med" data-id="${m.id}">✏️</button>
                            <button class="icon-btn" data-action="delete-med" data-id="${m.id}">🗑️</button>
                        </div>
                    </div>
                    <div class="med-inv-row">
                        <div class="inv-days-left ${isLow ? "low" : ""}">약 ${daysLeft}일분 남음${isLow ? " · 재고 부족" : ""}</div>
                        <div class="inv-qty-control">
                            <button class="qty-btn" data-action="dec-qty" data-id="${m.id}">－</button>
                            <span class="qty-value">${m.quantity}${escapeHtml(m.unit || "")}</span>
                            <button class="qty-btn" data-action="inc-qty" data-id="${m.id}">＋</button>
                        </div>
                    </div>
                </div>`;
                })
                .join("");
        }

        return `
            <div class="section-title">내 약물 (${medicines.length})</div>
            ${listHtml}
            <button class="fab" data-action="new-med" title="약물 추가">+</button>
        `;
    }

    let draftMed = null; // 작성 중인 폼 상태 — 시간 추가/삭제로 재렌더링돼도 유지됨

    function renderMedicineForm(idOrNew) {
        const isNew = idOrNew === "new";

        if (!draftMed || draftMed._formKey !== idOrNew) {
            const medicines = loadMedicines();
            const base = isNew
                ? { id: uid(), name: "", dosage: "", unit: "정", times: ["08:00"], quantity: 30, threshold: 5, createdAt: todayStr() }
                : medicines.find((m) => m.id === idOrNew);
            if (!base) return;
            draftMed = { ...base, times: [...base.times], _formKey: idOrNew };
        }
        const med = draftMed;

        const timesHtml = med.times
            .map(
                (t, i) => `
            <div class="time-row">
                <input type="time" class="med-time-input" value="${t}" data-index="${i}">
                <button type="button" class="time-remove" data-action="remove-time" data-index="${i}">✕</button>
            </div>`
            )
            .join("");

        const overlay = document.createElement("div");
        overlay.className = "form-overlay";
        overlay.id = "med-form-overlay";
        overlay.innerHTML = `
            <div class="form-sheet">
                <h3>${isNew ? "약물 추가" : "약물 수정"}</h3>
                <form id="med-form">
                    <div class="form-row">
                        <label>약물명</label>
                        <input type="text" id="f-name" required value="${escapeAttr(med.name)}" placeholder="예: 오메가3">
                    </div>
                    <div class="form-grid-2">
                        <div class="form-row">
                            <label>1회 복용량</label>
                            <input type="text" id="f-dosage" value="${escapeAttr(med.dosage)}" placeholder="예: 1">
                        </div>
                        <div class="form-row">
                            <label>단위</label>
                            <select id="f-unit">
                                ${["정", "캡슐", "ml", "포"].map((u) => `<option ${med.unit === u ? "selected" : ""}>${u}</option>`).join("")}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <label>복용 시간</label>
                        <div id="time-rows">${timesHtml}</div>
                        <button type="button" class="link-btn" data-action="add-time">+ 시간 추가</button>
                    </div>
                    <div class="form-grid-2">
                        <div class="form-row">
                            <label>현재 재고</label>
                            <input type="number" id="f-quantity" min="0" value="${med.quantity}">
                        </div>
                        <div class="form-row">
                            <label>재고 알림 기준</label>
                            <input type="number" id="f-threshold" min="0" value="${med.threshold}">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" data-action="cancel-form">취소</button>
                        <button type="submit" class="btn btn-primary">저장</button>
                    </div>
                </form>
            </div>
        `;
        appEl.appendChild(overlay);

        function syncDraftFromInputs() {
            draftMed.name = overlay.querySelector("#f-name").value;
            draftMed.dosage = overlay.querySelector("#f-dosage").value;
            draftMed.unit = overlay.querySelector("#f-unit").value;
            draftMed.quantity = overlay.querySelector("#f-quantity").value;
            draftMed.threshold = overlay.querySelector("#f-threshold").value;
        }

        overlay.querySelector('[data-action="cancel-form"]').addEventListener("click", () => {
            overlay.remove();
            openForm = null;
            draftMed = null;
        });

        overlay.querySelector('[data-action="add-time"]').addEventListener("click", () => {
            syncDraftFromInputs();
            draftMed.times.push("08:00");
            overlay.remove();
            renderMedicineForm(idOrNew);
        });

        overlay.querySelectorAll('[data-action="remove-time"]').forEach((btn) => {
            btn.addEventListener("click", () => {
                syncDraftFromInputs();
                const idx = Number(btn.dataset.index);
                draftMed.times.splice(idx, 1);
                overlay.remove();
                renderMedicineForm(idOrNew);
            });
        });

        overlay.querySelector("#med-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const times = Array.from(overlay.querySelectorAll(".med-time-input")).map((inp) => inp.value);
            const updated = {
                id: med.id,
                name: overlay.querySelector("#f-name").value.trim(),
                dosage: overlay.querySelector("#f-dosage").value.trim(),
                unit: overlay.querySelector("#f-unit").value,
                times: times.length ? times : ["08:00"],
                quantity: Number(overlay.querySelector("#f-quantity").value) || 0,
                threshold: Number(overlay.querySelector("#f-threshold").value) || 0,
                createdAt: med.createdAt || todayStr(),
            };
            if (!updated.name) return;

            const list = loadMedicines();
            const idx = list.findIndex((m) => m.id === updated.id);
            if (idx >= 0) list[idx] = updated;
            else list.push(updated);
            saveMedicines(list);

            const others = list.filter((m) => m.id !== updated.id);
            const warnings = [];
            others.forEach((o) => {
                pairInteractions(updated.name, o.name).forEach((rule) => warnings.push({ a: updated.name, b: o.name, ...rule }));
            });

            overlay.remove();
            openForm = null;
            draftMed = null;
            render();

            if (warnings.length) showInteractionAlert(updated.name, warnings);
        });
    }

    function showInteractionAlert(medName, warnings) {
        const overlay = document.createElement("div");
        overlay.className = "alert-overlay";
        overlay.id = "interaction-alert-overlay";
        overlay.innerHTML = `
            <div class="alert-sheet">
                <div class="alert-icon">⚠️</div>
                <h3>상호작용 확인 필요</h3>
                <p class="alert-sub">${escapeHtml(medName)}과(와) 함께 복용 중인 약물 사이에 확인이 필요한 조합이 있습니다.</p>
                ${warnings
                    .map(
                        (w) => `
                    <div class="card interaction-card">
                        <div class="pair">
                            <span>${escapeHtml(w.a)} + ${escapeHtml(w.b)}</span>
                            <span class="risk-badge risk-${w.level}">${RISK_LABEL[w.level]}</span>
                        </div>
                        <div class="desc">${escapeHtml(w.desc)}</div>
                        <div class="rec">권장사항: ${escapeHtml(w.rec)}</div>
                    </div>`
                    )
                    .join("")}
                <button type="button" class="btn btn-primary" id="alert-confirm-btn">확인했습니다</button>
            </div>
        `;
        appEl.appendChild(overlay);
        overlay.querySelector("#alert-confirm-btn").addEventListener("click", () => overlay.remove());
    }

    // ---------- 영양 부족 분석 (등록 여부가 아니라 실제 최근 복용 기록 기반) ----------
    // 실제 서비스에서는 전문가 검수를 거친 영양 분석 로직으로 교체해야 함 (데모용 단순 키워드 매칭)
    const NUTRIENT_CATEGORIES = [
        { name: "비타민C", keywords: ["비타민c", "비타민 c"], hint: "면역력, 피로 회복에 관여하는 영양소예요." },
        { name: "비타민D", keywords: ["비타민d", "비타민 d"], hint: "뼈 건강, 면역 기능과 관련 있어요. 실내 활동이 많다면 부족하기 쉬워요." },
        { name: "비타민B군", keywords: ["비타민b", "비타민 b"], hint: "에너지 대사와 신경 기능에 관여해요." },
        { name: "오메가3", keywords: ["오메가3", "오메가 3"], hint: "혈행 및 눈 건강에 도움을 줄 수 있어요." },
        { name: "칼슘", keywords: ["칼슘"], hint: "뼈와 치아 건강의 기본이 되는 영양소예요." },
        { name: "마그네슘", keywords: ["마그네슘"], hint: "근육·신경 기능, 피로감과 관련 있어요." },
        { name: "아연", keywords: ["아연"], hint: "면역 기능과 상처 회복에 관여해요." },
        { name: "철분", keywords: ["철분"], hint: "빈혈 예방과 관련된 영양소예요." },
        { name: "유산균(프로바이오틱스)", keywords: ["유산균", "프로바이오틱스"], hint: "장 건강 관리에 도움을 줄 수 있어요." },
        { name: "콜라겐", keywords: ["콜라겐"], hint: "피부·관절 탄력과 관련 있어요." },
    ];

    const MAIN_NUTRIENTS = ["비타민C", "오메가3", "칼슘", "마그네슘"];
    const NUTRIENT_BAR_COLORS = ["#025124", "#0a7a3a", "#4c9a63", "#7fb894"];

    function recentDates(days) {
        const list = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            list.push(toDateStr(d));
        }
        return list;
    }

    // 최근 N일 각각에 대해 그날 실제로 "복용완료"로 표시된 모든 항목의
    // 이름(소문자)을 모음 — 반복 약물과 즉석 추가 항목을 모두 포함.
    function takenNamesByDate(dates) {
        const medicines = loadMedicines();
        return dates.map((dateStr) => {
            const intake = loadIntake(dateStr);
            const names = [];
            medicines.forEach((m) => {
                (m.times || []).forEach((t) => {
                    if (intake[m.id + "_" + t] === "taken") names.push(m.name.toLowerCase());
                });
            });
            loadAdhoc(dateStr).forEach((item) => {
                if (item.status === "taken") names.push(item.name.toLowerCase());
            });
            return names;
        });
    }

    function renderNutrition() {
        const dates = recentDates(7);
        const byDate = takenNamesByDate(dates);
        const activeNames = [].concat(...byDate);

        if (activeNames.length === 0) {
            return `
                <div class="section-title">영양 분석</div>
                <div class="empty-state">최근 7일간 실제로 "복용완료"로 체크한 기록이 없어 분석할 수 없어요.<br>홈에서 약을 등록하거나 오늘 먹은 것을 추가하고 체크해보세요.</div>
            `;
        }

        const rates = NUTRIENT_CATEGORIES.map((cat) => {
            const coveredDays = byDate.filter((names) => names.some((n) => cat.keywords.some((k) => n.includes(k)))).length;
            return { ...cat, rate: Math.round((coveredDays / dates.length) * 100) };
        });

        const chartItems = MAIN_NUTRIENTS.map((name) => rates.find((c) => c.name === name)).filter(Boolean);
        const chartHtml = `
            <div class="card nutrient-chart-card">
                ${chartItems
                    .map((c, i) => {
                        const fillPct = Math.max(c.rate, 8);
                        const color = NUTRIENT_BAR_COLORS[i % NUTRIENT_BAR_COLORS.length];
                        return `
                        <div class="nutrient-bar">
                            <div class="nutrient-bar-track">
                                <div class="nutrient-bar-fill" style="height:${fillPct}%; background:${color};">${c.rate}%</div>
                            </div>
                            <div class="nutrient-bar-label">${escapeHtml(c.name)}</div>
                        </div>`;
                    })
                    .join("")}
            </div>
        `;

        const covered = rates.filter((c) => c.rate > 0);
        const gaps = rates.filter((c) => c.rate === 0);

        const coveredHtml = covered.length
            ? `<div class="card">${covered.map((c) => `<span class="nutrient-chip covered">${escapeHtml(c.name)} ${c.rate}%</span>`).join("")}</div>`
            : `<div class="empty-state">최근 실제로 챙긴 기록에서 확인되는 영양소가 없어요.</div>`;

        const gapsHtml = gaps.length
            ? gaps
                  .map(
                      (c) => `
                <div class="card nutrient-gap-item">
                    <div class="nutrient-gap-name">⚠ ${escapeHtml(c.name)}</div>
                    <div class="nutrient-gap-hint">${escapeHtml(c.hint)}</div>
                </div>`
                  )
                  .join("")
            : `<div class="empty-state">분석 대상 영양소는 대부분 챙기고 계신 것으로 보여요.</div>`;

        return `
            <div class="disclaimer">최근 7일간 실제로 "복용완료" 체크한 기록만을 바탕으로 한 단순 데모 분석입니다. 실제 영양 상태는 혈액검사 등을 통해 전문가와 상담하세요.</div>

            <div class="section-title">주요 영양소 최근 7일 섭취율</div>
            ${chartHtml}

            <div class="section-title">최근 챙기고 있는 영양소</div>
            ${coveredHtml}

            <div class="section-title">부족할 수 있는 영양소</div>
            ${gapsHtml}
        `;
    }

    // ---------- 이벤트 위임 ----------
    function attachEvents() {
        root.querySelectorAll("[data-action]").forEach((el) => {
            el.addEventListener("click", handleAction);
        });
        root.querySelectorAll("[data-change-action]").forEach((el) => {
            el.addEventListener("change", handleChangeAction);
        });

        const adhocForm = root.querySelector("#adhoc-add-form");
        if (adhocForm) {
            adhocForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const input = document.getElementById("adhoc-name-input");
                addAdhocItem(selectedDate, input.value);
                render();
            });
        }
    }

    function handleChangeAction(e) {
        const action = e.currentTarget.dataset.changeAction;
        if (action === "set-condition") {
            selectedCondition = e.currentTarget.value;
            render();
        }
    }

    function handleAction(e) {
        const action = e.currentTarget.dataset.action;
        const key = e.currentTarget.dataset.key;
        const id = e.currentTarget.dataset.id;

        if (action === "take" || action === "skip" || action === "reset") {
            if (key.startsWith("adhoc:")) {
                const adhocId = key.slice("adhoc:".length);
                const list = loadAdhoc(selectedDate);
                const item = list.find((i) => i.id === adhocId);
                if (item) {
                    item.status = action === "reset" ? "pending" : action === "take" ? "taken" : "skipped";
                    saveAdhoc(selectedDate, list);
                }
            } else {
                const intake = loadIntake(selectedDate);
                if (action === "reset") delete intake[key];
                else intake[key] = action === "take" ? "taken" : "skipped";
                saveIntake(selectedDate, intake);
            }
            render();
        } else if (action === "delete-adhoc") {
            const adhocId = key.slice("adhoc:".length);
            const list = loadAdhoc(selectedDate).filter((i) => i.id !== adhocId);
            saveAdhoc(selectedDate, list);
            render();
        } else if (action === "add-rec-to-today") {
            addAdhocItem(selectedDate, e.currentTarget.dataset.name);
            render();
        } else if (action === "select-date") {
            selectedDate = e.currentTarget.dataset.date;
            render();
        } else if (action === "prev-week" || action === "next-week") {
            const delta = action === "prev-week" ? -7 : 7;
            const d = new Date(selectedDate + "T00:00:00");
            d.setDate(d.getDate() + delta);
            selectedDate = toDateStr(d);
            render();
        } else if (action === "new-med") {
            openForm = "new";
            render();
        } else if (action === "edit-med") {
            openForm = id;
            render();
        } else if (action === "delete-med") {
            if (confirm("이 약물을 삭제하시겠습니까?")) {
                const list = loadMedicines().filter((m) => m.id !== id);
                saveMedicines(list);
                render();
            }
        } else if (action === "inc-qty" || action === "dec-qty") {
            const list = loadMedicines();
            const med = list.find((m) => m.id === id);
            if (med) {
                med.quantity = Math.max(0, Number(med.quantity) + (action === "inc-qty" ? 1 : -1));
                saveMedicines(list);
                render();
            }
        }
    }

    // ---------- 유틸리티 ----------
    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function escapeAttr(str) {
        return escapeHtml(str);
    }

    // ---------- 초기 실행 ----------
    render();
})();
