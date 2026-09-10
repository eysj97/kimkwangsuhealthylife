// 브라우저에서 pushManager.subscribe()로 받은 구독 정보를 저장함.
// 이후 이 사용자 앞으로 예약된 알림을 보낼 때 이 구독 정보로 발송함.
const { redisSet } = require("./_lib");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        const { userId, subscription } = req.body || {};
        if (!userId || !subscription || !subscription.endpoint) {
            res.status(400).json({ error: "userId와 subscription이 필요해요." });
            return;
        }

        await redisSet(`sub:${userId}`, subscription);
        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
