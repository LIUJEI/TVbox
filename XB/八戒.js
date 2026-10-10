// 八戒影视 - QuickJS 版（APP JSON API）
const DOMAIN_CFG = "http://osstexll.oss-rg-china-mainland.aliyuncs.com/domainPath.json";
const DEVICE_ID = "2d590b9842d064a1";
const PLAY_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";

let HOST = "";
let USERID = "";
let TOKEN = "";
let initPromise = null;

function apiHeaders() {
    return {
        "User-Agent": "okhttp/4.12.0",
        "Content-Type": "application/json;charset=UTF-8",
        "Cache-Control": "no-cache",
        "client": "app",
        "deviceType": "Android",
        "deviceId": DEVICE_ID,
        "token": TOKEN
    };
}

async function httpGet(url, headers) {
    const r = await req(url, { headers: headers });
    return (r && r.content) || "";
}

async function httpPost(url, payload) {
    // TVBox req: postType='json' + data对象 会自动转JSON body
    const r = await req(url, {
        method: "POST",
        headers: apiHeaders(),
        data: payload || {},
        postType: "json"
    });
    return (r && r.content) || "";
}

function tryJson(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
}

// 惰性初始化：取域名 -> 取游客token
async function ensureInit() {
    if (HOST && TOKEN) return true;
    if (initPromise) return initPromise;
    initPromise = (async () => {
        try {
            if (!HOST) {
                const t = await httpGet(DOMAIN_CFG, { "User-Agent": "okhttp/4.12.0" });
                const j = tryJson(t);
                if (!j || !j.url || !j.url.length) return false;
                HOST = String(j.url[0]).replace(/\/+$/, "");
            }
            const vt = await httpGet(HOST + "/api/v1/app/user/visitorInfo", apiHeaders());
            const vj = tryJson(vt);
            if (!vj || !vj.data) return false;
            USERID = vj.data.id || "";
            TOKEN = vj.data.token || "";
            return !!TOKEN;
        } catch (e) {
            return false;
        } finally {
            initPromise = null;
        }
    })();
    return initPromise;
}

async function apiPost(path, payload) {
    if (!(await ensureInit())) return null;
    const txt = await httpPost(HOST + path, payload);
    const j = tryJson(txt);
    if (!j) return null;
    const code = (j.code === undefined) ? 200 : j.code;
    if (code !== 200 && code !== 0) return null;
    return j;
}

function buildItem(d, extra) {
    const item = {
        vod_id: String(d.id || ""),
        vod_name: d.name || "未知影片",
        vod_pic: d.cover || "",
        vod_remarks: d.area || "",
        vod_year: d.year || ""
    };
    if (extra) {
        for (const f of extra) item["vod_" + f] = d[f] || "";
    }
    return item;
}

function init(ext) {}

async function home(filter) {
    const j = await apiPost("/api/v1/app/screen/screenType", null);
    const classes = [];
    if (j && j.data) {
        for (const it of j.data) {
            if (it.id) classes.push({ type_id: String(it.id), type_name: it.name || "未命名分类" });
        }
    }
    return JSON.stringify({ class: classes });
}

async function homeVod() {
    const j = await apiPost("/api/v1/app/recommend/recommendList", null);
    let videos = [];
    const seen = {};
    if (j && j.data && j.data.length) {
        const tasks = [];
        for (const item of j.data) {
            if (!item.id) continue;
            tasks.push(apiPost("/api/v1/app/recommend/recommendSubList",
                { condition: item.id, pageNum: 1, pageSize: 6 }));
        }
        const results = await Promise.all(tasks);
        for (const r of results) {
            const recs = (r && r.data && r.data.records) || [];
            for (const v of recs) {
                const k = String(v.id || "");
                if (seen[k]) continue;
                seen[k] = 1;
                videos.push(buildItem(v));
            }
        }
    }
    // 推荐接口空/失败：fallback 用分类数据填充主页
    if (!videos.length) {
        const hc = await apiPost("/api/v1/app/screen/screenType", null);
        const classes = (hc && hc.data) || [];
        const tasks = [];
        for (const c of classes.slice(0, 4)) {
            tasks.push(apiPost("/api/v1/app/screen/screenMovie", {
                condition: { classify: "", region: "", sreecnTypeEnum: "NEWEST", typeId: c.id, year: "" },
                pageNum: 1, pageSize: 8
            }));
        }
        const results = await Promise.all(tasks);
        for (const r of results) {
            const recs = (r && r.data && r.data.records) || [];
            for (const v of recs) {
                const k = String(v.id || "");
                if (seen[k]) continue;
                seen[k] = 1;
                videos.push(buildItem(v));
            }
        }
    }
    return JSON.stringify({ list: videos });
}

async function category(tid, pg, filter, extend) {
    const pn = Math.max(parseInt(pg) || 1, 1);
    const j = await apiPost("/api/v1/app/screen/screenMovie", {
        condition: { classify: "", region: "", sreecnTypeEnum: "NEWEST", typeId: tid, year: "" },
        pageNum: pn,
        pageSize: 40
    });
    const recs = (j && j.data && j.data.records) || [];
    const videos = recs.map(v => buildItem(v, ["area", "year"]));
    return JSON.stringify({
        page: pn,
        pagecount: videos.length >= 40 ? pn + 1 : pn,
        limit: 40,
        total: 0,
        list: videos
    });
}

async function search(wd, quick, pg) {
    const pn = Math.max(parseInt(pg) || 1, 1);
    const j = await apiPost("/api/v1/app/search/searchMovie", {
        condition: { value: wd },
        pageNum: pn,
        pageSize: 40
    });
    const recs = (j && j.data && j.data.records) || [];
    const videos = recs.map(v => buildItem(v, ["area", "year", "desc"]));
    return JSON.stringify({ list: videos, page: pn });
}

function isShortDrama(data, playerList) {
    if (data.typeId === "M16") return true;
    const tn = data.typeName || data.classify || "";
    if (tn.indexOf("短剧") >= 0) return true;
    const kw = ["合集", "短剧", "RO", "分集"];
    for (const pl of playerList) {
        const n = pl.moviePlayerName || "";
        for (const k of kw) if (n.indexOf(k) >= 0) return true;
    }
    for (const pl of playerList) {
        if ((pl.episodeTotal || 0) > 80) return true;
    }
    return false;
}

async function detail(ids) {
    let videoId = Array.isArray(ids) ? ids[0] : ids;
    if (!videoId) return JSON.stringify({ list: [] });
    if (!(await ensureInit())) return JSON.stringify({ list: [] });

    const j = await apiPost("/api/v1/app/play/movieDetails",
        { id: videoId, source: 0, typeId: "M17", userId: USERID });
    const data = (j && j.data) || null;
    if (!data) return JSON.stringify({ list: [] });

    const dj = await apiPost("/api/v1/app/play/movieDesc", { id: videoId, typeId: "M17" });
    const d2 = (dj && dj.data) || {};

    const currentPlayerId = data.playerId || 0;
    const episodeList = data.episodeList || [];
    const playerList = data.moviePlayerList || [];

    const playUrls = [];
    const show = [];

    if (isShortDrama(data, playerList)) {
        for (const pl of playerList) {
            const plId = pl.id;
            const total = pl.episodeTotal;
            const name = pl.moviePlayerName || "未知源";
            if (!total || total === 0) continue;
            const eps = [];
            const max = Math.min(total, 500);
            for (let ep = 1; ep <= max; ep++) {
                eps.push(`第${ep}集$${ep}@${plId}@${videoId}@virtual`);
            }
            if (eps.length) {
                playUrls.push(eps.join("#"));
                show.push(name);
            }
        }
    } else if (episodeList.length > 0) {
        let curName = "默认源";
        for (const pl of playerList) {
            if (pl.id === currentPlayerId) { curName = pl.moviePlayerName || "默认源"; break; }
        }
        const eps = episodeList.map((ep, idx) =>
            `${ep.episode || (idx + 1)}$${videoId}@${currentPlayerId}@${ep.id || ""}@episode`);
        playUrls.push(eps.join("#"));
        show.push(curName);
        for (const pl of playerList) {
            if (pl.id === currentPlayerId) continue;
            const name = pl.moviePlayerName || "未知源";
            if (show.indexOf(name) >= 0) continue;
            const total = pl.episodeTotal || episodeList.length;
            if (total > 0) {
                const pu = [];
                const max = Math.min(total, 200);
                for (let ep = 1; ep <= max; ep++) {
                    pu.push(`第${ep}集$${ep}@${pl.id}@${videoId}@virtual`);
                }
                if (pu.length) {
                    playUrls.push(pu.join("#"));
                    show.push(name);
                }
            }
        }
    } else {
        for (const pl of playerList) {
            const total = pl.episodeTotal;
            const name = pl.moviePlayerName || "默认源";
            if (total && total > 0) {
                const pu = [];
                const max = Math.min(total, 200);
                for (let ep = 1; ep <= max; ep++) {
                    pu.push(`第${ep}集$${ep}@${pl.id}@${videoId}@virtual`);
                }
                if (pu.length) {
                    playUrls.push(pu.join("#"));
                    show.push(name);
                    break;
                }
            }
        }
    }

    if (!playUrls.length) {
        show.push("默认源");
        playUrls.push(`第1集$1@0@${videoId}@virtual`);
    }

    return JSON.stringify({
        list: [{
            vod_id: String(d2.id || videoId),
            vod_name: d2.name || data.name || "未知影片",
            vod_pic: d2.cover || data.cover || "",
            vod_content: d2.introduce || data.introduce || "",
            vod_year: d2.year || data.year || "",
            vod_area: d2.area || data.area || "",
            vod_remarks: "",
            vod_score: d2.score || data.score || "",
            type_name: d2.classify || data.classify || "",
            vod_director: d2.director || data.director || "",
            vod_play_from: show.join("$$$"),
            vod_play_url: playUrls.join("$$$")
        }]
    });
}

async function play(flag, id, flags) {
    const empty = { parse: 0, url: "", header: {} };
    if (!(await ensureInit())) return JSON.stringify(empty);
    const parts = String(id).split("@");
    if (parts.length < 4) return JSON.stringify(empty);

    const param = parts[0], playerid = parts[1], param2 = parts[2], param3 = parts[3];
    let payload;
    if (param3 === "virtual") {
        payload = {
            episodeIndex: String(Math.max(0, (parseInt(param) || 1) - 1)),
            id: parseInt(param2) || param2,
            playerId: playerid,
            source: 0,
            typeId: "M16",
            userId: USERID
        };
    } else {
        payload = {
            episodeId: param2,
            id: param,
            playerId: playerid,
            source: 0,
            typeId: "M16",
            userId: USERID
        };
    }

    const j = await apiPost("/api/v1/app/play/movieDetails", payload);
    const data = (j && j.data) || null;
    if (!data || !data.url) return JSON.stringify(empty);

    const pid = data.playerId || playerid;
    const at = await httpGet(
        HOST + "/api/v1/app/play/analysisMovieUrl?playerUrl=" + encodeURIComponent(data.url) + "&playerId=" + pid,
        apiHeaders());
    const aj = tryJson(at);
    const url = (aj && aj.data) || "";
    if (!url) return JSON.stringify(empty);

    return JSON.stringify({
        parse: 0,
        url: url,
        header: { "User-Agent": PLAY_UA }
    });
}

export default { init, home, homeVod, category, detail, play, search };
