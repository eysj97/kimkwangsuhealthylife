// 브라우저에서 잠금화면 알림을 허용하면, 정해진 시각들(11시/14시/새벽2시)에 매일
// 반복되는 QStash 예약을 만들어 둠. 다시 호출하면 기존 예약을 지우고 새로 만듦(덮어쓰기).
// 이 앱은 한국 사용자 전용이라 한국시간(KST, UTC+9 고정)만 다룸.
const { redisGet, redisSet, qstashRequest } = require("./_lib");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        const { userId, times } = req.body || {};
        if (!userId || !Array.isArray(times) || times.length === 0) {
            res.status(400).json({ error: "userId와 times 배열이 필요해요." });
            return;
        }

        const proto = req.headers["x-forwarded-proto"] || "https";
        const destination = `${proto}://${req.headers.host}/api/send-push`;

        const scheduleIds = [];
        for (let i = 0; i < times.length; i++) {
            const { hour, minute, groupIndex } = times[i];
            if (hour == null || minute == null) continue;

            const scheduleKey = `schedule:${userId}:general:${i}`;
            const existingScheduleId = await redisGet(scheduleKey);
            if (existingScheduleId) {
                await qstashRequest(`/v2/schedules/${existingScheduleId}`, { method: "DELETE" }).catch(() => {});
            }

            const hourUtc = (Number(hour) - 9 + 24) % 24;
            const cron = `${Number(minute)} ${hourUtc} * * *`;

            const result = await qstashRequest(`/v2/schedules/${encodeURIComponent(destination)}`, {
                method: "POST",
                headers: { "Upstash-Cron": cron },
                body: JSON.stringify({ userId, groupIndex }),
            });

            await redisSet(scheduleKey, result.scheduleId);
            scheduleIds.push(result.scheduleId);
        }

        res.status(200).json({ ok: true, scheduleIds });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
