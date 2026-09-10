// 브라우저에서 "매일 복용 알림"을 설정하면 이 함수가 QStash에 매일 반복되는
// 예약(cron)을 만들어 둠. 같은 영양제로 다시 설정하면 기존 예약을 지우고 새로 만듦(덮어쓰기).
// 이 앱은 한국 사용자 전용이라 한국시간(KST, UTC+9 고정)만 다룸.
const { redisGet, redisSet, qstashRequest } = require("./_lib");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        const { userId, name, hour, minute } = req.body || {};
        if (!userId || !name || hour == null || minute == null) {
            res.status(400).json({ error: "userId, name, hour, minute이 필요해요." });
            return;
        }

        const scheduleKey = `schedule:${userId}:${name}`;
        const existingScheduleId = await redisGet(scheduleKey);
        if (existingScheduleId) {
            await qstashRequest(`/v2/schedules/${existingScheduleId}`, { method: "DELETE" }).catch(() => {});
        }

        const hourUtc = (Number(hour) - 9 + 24) % 24;
        const cron = `${Number(minute)} ${hourUtc} * * *`;

        const proto = req.headers["x-forwarded-proto"] || "https";
        const destination = `${proto}://${req.headers.host}/api/send-push`;

        const result = await qstashRequest(`/v2/schedules/${encodeURIComponent(destination)}`, {
            method: "POST",
            headers: { "Upstash-Cron": cron },
            body: JSON.stringify({ userId, name }),
        });

        await redisSet(scheduleKey, result.scheduleId);
        res.status(200).json({ ok: true, scheduleId: result.scheduleId });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
