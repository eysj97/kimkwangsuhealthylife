// 여러 서버리스 함수(/api/*)가 공통으로 쓰는 Upstash Redis / QStash REST API 도우미.
// 둘 다 REST 기반이라 별도 SDK 없이 fetch만으로 호출함.

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const QSTASH_TOKEN = process.env.QSTASH_TOKEN;

async function redisCommand(args) {
    if (!REDIS_URL || !REDIS_TOKEN) {
        throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 환경변수가 설정되지 않았어요.");
    }
    const res = await fetch(REDIS_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${REDIS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Redis 요청 실패 (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.result;
}

async function redisSet(key, value) {
    return redisCommand(["SET", key, JSON.stringify(value)]);
}

async function redisGet(key) {
    const raw = await redisCommand(["GET", key]);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

async function redisDel(key) {
    return redisCommand(["DEL", key]);
}

async function qstashRequest(path, options = {}) {
    if (!QSTASH_TOKEN) {
        throw new Error("QSTASH_TOKEN 환경변수가 설정되지 않았어요.");
    }
    const res = await fetch(`https://qstash.upstash.io${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${QSTASH_TOKEN}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`QStash 요청 실패 (${res.status}): ${text}`);
    }
    return res.json().catch(() => ({}));
}

module.exports = { redisSet, redisGet, redisDel, qstashRequest };
