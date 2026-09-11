// 다른 기기에서 발급받은 6자리 코드로 저장된 데이터를 가져옴.
const { redisGet } = require("./_lib");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        const { code } = req.body || {};
        if (!code) {
            res.status(400).json({ error: "code가 필요해요." });
            return;
        }

        const codeEntry = await redisGet(`sync:code:${code}`);
        if (!codeEntry || !codeEntry.userId) {
            res.status(404).json({ error: "코드가 만료됐거나 잘못됐어요. 다른 기기에서 코드를 다시 발급받아주세요." });
            return;
        }

        const data = await redisGet(`sync:data:${codeEntry.userId}`);
        if (!data) {
            res.status(404).json({ error: "동기화할 데이터가 없어요." });
            return;
        }

        res.status(200).json({ ok: true, userId: codeEntry.userId, medicines: data.medicines, today: data.today, savedAt: data.savedAt });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
