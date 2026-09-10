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

    function init() {
        renderCalendar();
        const boxGrap = document.querySelector(".boxGrap");
        if (boxGrap) boxGrap.addEventListener("click", handleBoxGrapClick);

        showRandomWaitingMascot();
        const homeMenuRadio = document.getElementById("menu-home");
        if (homeMenuRadio) homeMenuRadio.addEventListener("change", showRandomWaitingMascot);

        checkReminders();
        setInterval(checkReminders, 30000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
