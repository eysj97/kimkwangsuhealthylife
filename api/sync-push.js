// 이 기기의 영양제/오늘의 목록 데이터를 서버에 저장하고, 다른 기기에서 입력할
// 짧은 동기화 코드(6자리 숫자)를 발급함. 코드는 10분 동안만 유효함.
// 사진(base64)은 용량이 커서 동기화 대상에서 제외함 — 텍스트 데이터만 동기화됨.
const { redisSet } = require("./_lib");

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        const { userId, medicines, today } = req.body || {};
        if (!userId) {
            res.status(400).json({ error: "userId가 필요해요." });
            return;
        }

        // 사진(base64) 필드는 너무 커서 DB에 안 맞을 수 있어 제외하고 저장
        const strippedMedicines = Array.isArray(medicines)
            ? medicines.map(({ photoUrl, labelPhoto, ...rest }) => rest)
            : [];

        await redisSet(`sync:data:${userId}`, {
            medicines: strippedMedicines,
            today: Array.isArray(today) ? today : [],
            savedAt: Date.now(),
        });

        const code = generateCode();
        await redisSet(`sync:code:${code}`, { userId }, 600); // 10분 후 만료

        res.status(200).json({ ok: true, code });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
