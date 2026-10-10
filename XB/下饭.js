// 剧下饭 (manian.juxiafan.com) - QuickJS 版 (原 下饭.py)
// JSON REST API + AES-256-ECB datasign 签名; 多域名顺序回退; 直播/虎牙走服务端 analysisUrl 解析
// 注意: TVBox req 的 timeout 单位是毫秒; 所有接口返回 JSON.stringify

// ==================== 基础编码 ====================
const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64enc(bytes) {
    let out = "", i = 0;
    for (; i + 3 <= bytes.length; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63] + B64C[(n >> 6) & 63] + B64C[n & 63];
    }
    if (i < bytes.length) {
        const n = (bytes[i] << 16) | (i + 1 < bytes.length ? bytes[i + 1] << 8 : 0);
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63];
        out += i + 1 < bytes.length ? B64C[(n >> 6) & 63] : "=";
        out += "=";
    }
    return out;
}
function utf8enc(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
        else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
            c = 0x10000 + ((c & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
            out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

// ==================== AES-256-ECB (仅加密, 用于 datasign) ====================
const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const RCON = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154];
function xtime(x) { x <<= 1; return x & 256 ? (x ^ 0x11b) & 255 : x; }
function aesKeyExp(key) {
    const Nk = key.length / 4, Nr = Nk + 6, w = [];
    for (let i = 0; i < Nk; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
    for (let i = Nk; i < 4 * (Nr + 1); i++) {
        let t = w[i - 1].slice();
        if (i % Nk === 0) { t = [SBOX[t[1]], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]]; t[0] ^= RCON[i / Nk]; }
        else if (Nk > 6 && i % Nk === 4) { t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]]; }
        w.push([w[i - Nk][0] ^ t[0], w[i - Nk][1] ^ t[1], w[i - Nk][2] ^ t[2], w[i - Nk][3] ^ t[3]]);
    }
    return { w: w, Nr: Nr };
}
function aesAddRK(s, w, r) { for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) s[i + 4 * c] ^= w[4 * r + c][i]; }
function aesSub(s) { for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]]; }
function aesShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c + r) % 4)]);
        for (let c = 0; c < 4; c++) s[r + 4 * c] = t[c];
    }
}
function aesMix(s) {
    for (let c = 0; c < 4; c++) {
        const a = [s[4 * c], s[1 + 4 * c], s[2 + 4 * c], s[3 + 4 * c]];
        s[4 * c] = xtime(a[0]) ^ (xtime(a[1]) ^ a[1]) ^ a[2] ^ a[3];
        s[1 + 4 * c] = a[0] ^ xtime(a[1]) ^ (xtime(a[2]) ^ a[2]) ^ a[3];
        s[2 + 4 * c] = a[0] ^ a[1] ^ xtime(a[2]) ^ (xtime(a[3]) ^ a[3]);
        s[3 + 4 * c] = (xtime(a[0]) ^ a[0]) ^ a[1] ^ a[2] ^ xtime(a[3]);
    }
}
function pkcs7pad(bytes) { const n = 16 - (bytes.length % 16), out = bytes.slice(); for (let i = 0; i < n; i++) out.push(n); return out; }
function aesEncBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, 0);
    for (let r = 1; r < ek.Nr; r++) { aesSub(s); aesShift(s); aesMix(s); aesAddRK(s, ek.w, r); }
    aesSub(s); aesShift(s); aesAddRK(s, ek.w, ek.Nr);
    return s;
}
function aesEcbEncB64(text, keyBytes) {
    const ek = aesKeyExp(keyBytes), data = pkcs7pad(utf8enc(text)), out = [];
    for (let i = 0; i < data.length; i += 16) { const b = aesEncBlock(ek, data.slice(i, i + 16)); for (const x of b) out.push(x); }
    return b64enc(out);
}

// ==================== 配置 ====================
const BASE_URLS = [
    "http://manian.juxiafan.com",
    "http://195.225.24.128:6213",
    "http://jugaoqing.com",
    "http://jumianfei.com",
    "http://juyongjiu.com",
    "http://kuailezhuiju2.com",
    "http://zhuiju666.com",
    "http://194.147.100.155:7744"
];
const AES_KEY = utf8enc("kZ6fT8oF6oM8eX6lF7eH2rJ3pW7gW0kC"); // 32字节 -> AES-256
const UA = "okhttp/4.12.0";
const LIVE_TYPE_ID = 22023;
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
const TIMEOUT = 12000; // 毫秒

let _host = BASE_URLS[0];
const _catSeen = {}; // 按分类记忆已返回 vod_id, 解决服务端分页重叠导致跨页重复

// ==================== HTTP / 签名 ====================
function quotePlus(s) {
    return encodeURIComponent(String(s)).replace(/%20/g, "+").replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function fixHost(h) {
    if (!h || !String(h).trim()) return BASE_URLS[0];
    return String(h).replace(/\/+$/, "");
}
// 顺序回退: 配置host优先, 再BASE_URLS, 返回第一个含 "code" 的响应
function postAuto(path, body, contentType) {
    const urls = [];
    const h = fixHost(_host);
    if (urls.indexOf(h) < 0) urls.push(h);
    for (const b of BASE_URLS) if (urls.indexOf(b) < 0) urls.push(b);
    let last = "{}";
    for (const u of urls) {
        try {
            const opts = { method: "POST", headers: { "User-Agent": UA }, timeout: TIMEOUT };
            if (body != null) opts.data = body;
            if (contentType) opts.headers["Content-Type"] = contentType;
            const r = req(u + path, opts);
            last = (r && r.content) || "{}";
            if (last.indexOf('"code"') >= 0) return last;
        } catch (e) { /* 下一域名 */ }
    }
    return last;
}
function getAuto(path) {
    const urls = [];
    const h = fixHost(_host);
    if (urls.indexOf(h) < 0) urls.push(h);
    for (const b of BASE_URLS) if (urls.indexOf(b) < 0) urls.push(b);
    for (const u of urls) {
        try {
            const r = req(u + path, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
            const t = (r && r.content) || "";
            if (t.indexOf('"code"') >= 0) return t;
        } catch (e) { /* 下一域名 */ }
    }
    return "{}";
}
function sortedEntries(params) {
    return Object.keys(params).sort().map(k => [k, params[k]]);
}
function postForm(path, params) {
    params.timestamp = String(Math.floor(Date.now() / 1000));
    const items = sortedEntries(params);
    const concat = items.map(kv => kv[0] + "=" + quotePlus(kv[1])).join("&");
    const ds = aesEcbEncB64(concat, AES_KEY);
    const form = concat + "&datasign=" + quotePlus(ds);
    return postAuto(path, form, "application/x-www-form-urlencoded");
}
function postJson(path, params) {
    params.timestamp = String(Math.floor(Date.now() / 1000));
    const items = sortedEntries(params);
    const concat = items.map(kv => kv[0] + "=" + String(kv[1])).join("&");
    const ds = aesEcbEncB64(concat, AES_KEY);
    const obj = {};
    for (const kv of items) obj[kv[0]] = kv[1];
    obj.datasign = ds;
    return postAuto(path, JSON.stringify(obj), "application/json;charset=UTF-8");
}

// ==================== 业务 ====================
function buildList(resp, page, idDesc, seen) {
    let data = {};
    try { data = JSON.parse(resp).data || {}; } catch (e) {}
    const localSeen = {}, lst = [];
    for (const v of (data.list || [])) {
        if (!v || v.id == null) continue;
        const vid = String(v.id);
        if (localSeen[vid]) continue;
        localSeen[vid] = 1;
        if (seen && seen[vid]) continue;
        lst.push({
            vod_id: vid,
            vod_name: v.name || "",
            vod_pic: v.videoPic || "",
            vod_remarks: v.remarks || ""
        });
    }
    if (idDesc && lst.length) {
        try { lst.sort((a, b) => (parseInt(b.vod_id) || 0) - (parseInt(a.vod_id) || 0)); } catch (e) {}
    }
    let pg = parseInt(page) || 1;
    let pagecount = parseInt(data.totalPage) || 1;
    return { page: pg, pagecount: pagecount, limit: data.limit || 20, total: data.totalCount || 0, list: lst };
}

function doCategory(tid, pg, seen) {
    let page = parseInt(pg) || 1;
    const typeId = parseInt(tid) || 0;
    // 直播分类
    if (typeId === LIVE_TYPE_ID) {
        const lst = [];
        try {
            const data = JSON.parse(getAuto("/api/v1/video/liveVideo")).data || {};
            for (const v of (data.list || [])) {
                if (!v || v.id == null) continue;
                lst.push({
                    vod_id: String(v.id),
                    vod_name: v.name || "",
                    vod_pic: v.videoPic || "",
                    vod_remarks: v.remarks || (v.typeId ? "直播" : "")
                });
            }
        } catch (e) {}
        return { page: 1, pagecount: 1, limit: lst.length, total: lst.length, list: lst };
    }
    // 主数据源: index (参数 pageNum)。注意: 服务端 index 接口 pageNum>=2 时分页损坏(只回2条且重叠),
    // 而 search 接口分页正常(40条/页, id升序), 故 p2+ 走 search(空关键词, id降序)补齐, 配合跨页去重
    if (page >= 2) {
        return buildList(postJson("/api/v1/video/search", { keyword: "", typeId: typeId, pageNum: page }), page, true, seen);
    }
    let res = buildList(postJson("/api/v1/video/index", { pageNum: page, typeId: typeId }), page, false, seen);
    // fallback 仅限第1页
    if (page === 1 && (res.list || []).length < 10) {
        try {
            const res2 = buildList(postJson("/api/v1/video/search", { keyword: "", typeId: typeId, pageNum: page }), page, true, seen);
            if ((res2.list || []).length > (res.list || []).length) res = res2;
        } catch (e) {}
    }
    return res;
}

function fetchDetail(vid) {
    try { return JSON.parse(postForm("/api/v1/video/videoDetails", { id: String(vid) })).data || {}; } catch (e) { return {}; }
}
function withPrefix(s) {
    s = s || "";
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

function analysisUrl(sourceCode, pc) {
    if (!sourceCode || !pc) return "";
    try {
        const u = JSON.parse(postForm("/api/v1/player/analysisUrl", { from: sourceCode, code: pc })).data || "";
        if (String(u).indexOf("http") === 0) return String(u);
    } catch (e) {}
    return "";
}

// ==================== TVBox 接口 ====================
async function init(ext) {
    if (ext) {
        const s = String(ext).trim();
        if (s.indexOf("http") === 0) _host = fixHost(s);
        else if (s.indexOf("base=") === 0) _host = fixHost(s.slice(5));
    }
}

async function home(filter) {
    const resp = postAuto("/api/v1/video/classifies", null, null);
    let data = [];
    try { data = JSON.parse(resp).data || []; } catch (e) {}
    const cls = [];
    for (const c of data) {
        if (c && c.id && c.name) cls.push({ type_id: String(c.id), type_name: c.name });
    }
    cls.sort((a, b) => {
        const x = /^\d+$/.test(a.type_id) ? parseInt(a.type_id) : 1e9;
        const y = /^\d+$/.test(b.type_id) ? parseInt(b.type_id) : 1e9;
        return x - y;
    });
    if (!cls.some(c => c.type_id === String(LIVE_TYPE_ID))) cls.push({ type_id: String(LIVE_TYPE_ID), type_name: "直播" });
    return JSON.stringify({ class: cls, filters: {} });
}

async function homeVod() {
    // 原版 _reco: 推荐 = 分类 22016 第1页
    try {
        const c = doCategory("22016", "1", null);
        if (c.list && c.list.length) return JSON.stringify({ list: c.list });
    } catch (e) {}
    // 降级: 第一个分类第1页
    try {
        const h = JSON.parse(await home(false));
        const cls = (h.class || []).filter(c => c.type_id !== String(LIVE_TYPE_ID));
        if (cls.length) {
            const c2 = doCategory(cls[0].type_id, "1", null);
            return JSON.stringify({ list: c2.list || [] });
        }
    } catch (e) {}
    return JSON.stringify({ list: [] });
}

async function category(tid, pg, filter, extend) {
    const tidS = String(tid);
    const page = parseInt(pg) || 1;
    if (page === 1) _catSeen[tidS] = {}; // 回到第1页重置记忆
    const seen = _catSeen[tidS];
    const res = doCategory(tidS, String(page), seen);
    if (seen) for (const item of (res.list || [])) seen[item.vod_id] = 1;
    return JSON.stringify(res);
}

async function detail(ids) {
    const vid = Array.isArray(ids) ? ids[0] : ids;
    const data = fetchDetail(vid);
    if (!data || !data.id) return JSON.stringify({ list: [] });
    const sources = data.playerSource || [];
    const fromNames = [], fromUrls = [], nameCnt = {};
    for (const src of sources) {
        const eps = src.episodes || [];
        if (!eps.length) continue;
        let name = src.sourceName || "剧下饭";
        if (nameCnt[name]) { nameCnt[name]++; name = name + nameCnt[name]; }
        else nameCnt[name] = 1;
        const segs = [];
        for (let i = 1; i <= eps.length; i++) {
            let epName = (eps[i - 1].episodeName || "") || ("第" + i + "集");
            epName = epName.replace(/\$/g, "_").replace(/#/g, "_");
            segs.push(epName + "$" + vid + "_" + i);
        }
        fromNames.push(name);
        fromUrls.push(segs.join("#"));
    }
    if (!fromUrls.length) return JSON.stringify({ list: [] });
    return JSON.stringify({ list: [{
        vod_id: String(data.id || vid),
        vod_name: data.name || "",
        vod_pic: data.videoPic || "",
        vod_actor: data.actor || "",
        vod_director: data.director || "",
        vod_remarks: data.remarks || "",
        vod_content: withPrefix(data.content),
        vod_year: data.year || "",
        vod_area: data.area || "",
        vod_play_from: fromNames.join("$$$"),
        vod_play_url: fromUrls.join("$$$")
    }] });
}

async function play(flag, id, vipFlags) {
    const pid = String(id);
    const idx = pid.lastIndexOf("_");
    let vid = null, ep = 0;
    if (idx > 0) {
        const maybeEp = parseInt(pid.slice(idx + 1));
        if (!isNaN(maybeEp)) { vid = pid.slice(0, idx); ep = maybeEp; }
    }
    if (vid == null) return JSON.stringify({ parse: 0, url: pid, header: { "User-Agent": UA } });
    const data = fetchDetail(vid);
    const sources = data.playerSource || [];
    const flagS = String(flag || "").trim();
    const ordered = [];
    for (const src of sources) if (String(src.sourceName || "").trim() === flagS) ordered.push(src);
    for (const src of sources) if (ordered.indexOf(src) < 0) ordered.push(src);
    for (const src of ordered) {
        const eps = src.episodes || [];
        if (!eps.length || ep > eps.length) continue;
        const pc = (eps[ep - 1] || {}).playerCode || "";
        const parseUrl = src.parseUrl || "";
        const sourceCode = src.sourceCode || "";
        if (parseUrl && pc) {
            let u = "";
            try {
                const r = req(parseUrl + pc, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
                u = JSON.parse((r && r.content) || "{}").url || "";
            } catch (e) {}
            if (u) return JSON.stringify({ parse: 0, url: u, header: { "User-Agent": UA } });
        }
        // 直播/加密码: 优先服务端 analysisUrl 秒播解析
        if (pc && String(pc).indexOf("http") !== 0) {
            const u = analysisUrl(sourceCode, pc);
            if (u) {
                const headers = { "User-Agent": UA };
                if (sourceCode === "huya") headers["Referer"] = "https://www.huya.com/";
                return JSON.stringify({ parse: 0, url: u, header: headers });
            }
            return JSON.stringify({ parse: 0, url: pc, header: { "User-Agent": UA } });
        } else if (pc) {
            return JSON.stringify({ parse: 0, url: pc, header: { "User-Agent": UA } });
        }
    }
    return JSON.stringify({ parse: 0, url: "", header: { "User-Agent": UA } });
}

async function search(key, quick, pg) {
    key = String(key || "").trim().replace(/^["']+|["']+$/g, "");
    if (!key) return JSON.stringify({ page: 1, pagecount: 0, limit: 20, total: 0, list: [] });
    if (key.indexOf("%") >= 0) {
        try { const dec = decodeURIComponent(key); if (dec && dec !== key) key = dec.trim(); } catch (e) {}
    }
    if (key.indexOf("\\u") >= 0 && /^[\x00-\x7F]*$/.test(key)) {
        try {
            const dec = key.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
            if (dec && dec !== key) key = dec;
        } catch (e) {}
    }
    let page = parseInt(pg) || 1;
    if (page < 1) page = 1;
    return JSON.stringify(buildList(postJson("/api/v1/video/search", { keyword: key, pageNum: page }), page, true, null));
}

export default { init, home, homeVod, category, detail, play, search };