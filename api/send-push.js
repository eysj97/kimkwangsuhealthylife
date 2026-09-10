// QStash가 예약된 시각에 이 엔드포인트를 호출하면, 저장해둔 구독 정보로
// 실제 푸시 알림을 보냄. 앱이 완전히 꺼져 있어도(브라우저를 안 열어도) 동작함.
const webpush = require("web-push");
const { redisGet } = require("./_lib");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            res.status(500).json({ error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 환경변수가 설정되지 않았어요." });
            return;
        }

        const { userId, name } = req.body || {};
        if (!userId || !name) {
            res.status(400).json({ error: "userId와 name이 필요해요." });
            return;
        }

        const subscription = await redisGet(`sub:${userId}`);
        if (!subscription) {
            // 구독이 없거나 만료됨 - QStash 스케줄은 그대로 두되 조용히 무시
            res.status(200).json({ ok: true, skipped: "no-subscription" });
            return;
        }

        webpush.setVapidDetails("mailto:geongwangja@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        await webpush.sendNotification(
            subscription,
            JSON.stringify({
                title: `💊 ${name} 복용하세요`,
                body: "지금 복용할 시간이에요.",
            })
        );

        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
