// 金牌影视 - QuickJS 版 (原 金牌.py by @嗷呜, mw-movie API, MD5+SHA1 双重签名)
const DEFAULT_SITE = "https://www.jiabaide.cn";
const SIGN_KEY = "cb808529bae6b6be45ecfab29a4889bc";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36";

let host = DEFAULT_SITE;

// ---------- UTF-8 / MD5 / SHA1 (纯JS实现, 与 pycryptodome hexdigest 一致) ----------
function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
        else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
            const c2 = str.charCodeAt(++i);
            c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
            out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

function hexLE(n) {
    let s = "";
    for (let i = 0; i < 4; i++) {
        const b = (n >>> (i * 8)) & 0xFF;
        s += (b < 16 ? "0" : "") + b.toString(16);
    }
    return s;
}

function hexBE(n) {
    let s = "";
    for (let i = 3; i >= 0; i--) {
        const b = (n >>> (i * 8)) & 0xFF;
        s += (b < 16 ? "0" : "") + b.toString(16);
    }
    return s;
}

const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const MD5_K = (function () {
    const k = [];
    for (let i = 0; i < 64; i++) k.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
    return k;
})();

function md5Hex(str) {
    const m = utf8Bytes(str);
    const bitLen = m.length * 8;
    m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    m.push(bitLen & 0xFF, (bitLen >>> 8) & 0xFF, (bitLen >>> 16) & 0xFF, (bitLen >>> 24) & 0xFF, 0, 0, 0, 0);
    let a0 = 0x67452301, b0 = 0xEFCDAB89, c0 = 0x98BADCFE, d0 = 0x10325476;
    for (let off = 0; off < m.length; off += 64) {
        const M = [];
        for (let j = 0; j < 16; j++) {
            M[j] = m[off + j * 4] | (m[off + j * 4 + 1] << 8) | (m[off + j * 4 + 2] << 16) | (m[off + j * 4 + 3] << 24);
        }
        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            F = (F + A + MD5_K[i] + M[g]) | 0;
            A = D; D = C; C = B;
            B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) | 0;
        }
        a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    return hexLE(a0) + hexLE(b0) + hexLE(c0) + hexLE(d0);
}

function sha1Hex(str) {
    const m = utf8Bytes(str);
    const bitLen = m.length * 8;
    m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    m.push(0, 0, 0, 0, (bitLen >>> 24) & 0xFF, (bitLen >>> 16) & 0xFF, (bitLen >>> 8) & 0xFF, bitLen & 0xFF);
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    for (let off = 0; off < m.length; off += 64) {
        const w = [];
        for (let i = 0; i < 16; i++) {
            w[i] = (m[off + i * 4] << 24) | (m[off + i * 4 + 1] << 16) | (m[off + i * 4 + 2] << 8) | m[off + i * 4 + 3];
        }
        for (let i = 16; i < 80; i++) {
            const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
            w[i] = (x << 1) | (x >>> 31);
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let i = 0; i < 80; i++) {
            let f, k;
            if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6; }
            const t = (((a << 5) | (a >>> 27)) + (f | 0) + e + k + (w[i] | 0)) | 0;
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    return hexBE(h0) + hexBE(h1) + hexBE(h2) + hexBE(h3) + hexBE(h4);
}

// ---------- 工具 ----------
function joinRaw(p) {
    const parts = [];
    for (const k in p) parts.push(k + "=" + p[k]);
    return parts.join("&");
}

function genUuid() {
    let s = "";
    for (let i = 0; i < 32; i++) {
        if (i === 12) { s += "4"; continue; }
        const r = Math.floor(Math.random() * 16);
        s += (i === 16 ? (r & 3) | 8 : r).toString(16);
    }
    return s.substring(0, 8) + "-" + s.substring(8, 12) + "-" + s.substring(12, 16) + "-" + s.substring(16, 20) + "-" + s.substring(20);
}

// 带签名的 API GET 请求: sign = SHA1(MD5("业务参数&key=固定值&t=毫秒"))
async function apiGet(path, bizParams) {
    const t = String(Date.now());
    const p = {};
    if (bizParams) { for (const k in bizParams) p[k] = String(bizParams[k]); }
    p.key = SIGN_KEY;
    p.t = t;
    const sign = sha1Hex(md5Hex(joinRaw(p)));
    let url = host + path;
    if (bizParams) {
        const q = [];
        for (const k in bizParams) q.push(k + "=" + encodeURIComponent(String(bizParams[k])));
        if (q.length) url += "?" + q.join("&");
    }
    try {
        const r = await req(url, {
            headers: {
                "User-Agent": UA,
                "Accept": "application/json, text/plain, */*",
                "sign": sign,
                "t": t,
                "deviceid": genUuid()
            }
        });
        return JSON.parse((r && r.content) || "{}");
    } catch (e) { return {}; }
}

// 多域名测速(串行GET计时, 取最快; 对应原版 host_late 并发HEAD)
async function pickHost(urls) {
    const list = [];
    for (const u of urls) { const s = String(u).trim(); if (s) list.push(s); }
    if (!list.length) return DEFAULT_SITE;
    if (list.length === 1) return list[0];
    let best = "", bestMs = Infinity;
    for (const u of list) {
        const t0 = Date.now();
        try {
            const r = await req(u, { headers: { "User-Agent": UA }, timeout: 3000 });
            const c = (r && r.content) || "";
            if (!c) continue;
            const ms = Date.now() - t0;
            if (ms < bestMs) { bestMs = ms; best = u; }
        } catch (e) {}
    }
    return best || list[0];
}

async function init(ext) {
    let e = ext;
    if (typeof e === "string" && e.trim()) {
        try { e = JSON.parse(e); } catch (e2) { e = {}; }
    }
    let sites = [];
    if (e && typeof e === "object" && e.site) sites = String(e.site).split(",");
    host = (await pickHost(sites)).replace(/\/+$/, "");
}

// ---------- 字段名转换: vodId->vod_id, typeName->type_name (对应原版 convert_field_name) ----------
function convertField(f) {
    f = String(f).toLowerCase();
    if (f.indexOf("vod") === 0 && f.length > 3) f = f.split("vod").join("vod_");
    if (f.indexOf("type") === 0 && f.length > 4) f = f.split("type").join("type_");
    return f;
}

function getVod(arr) {
    const out = [];
    for (const item of (arr || [])) {
        if (!item || typeof item !== "object") continue;
        const o = {};
        for (const k in item) o[convertField(k)] = item[k];
        out.push(o);
    }
    return out;
}

// ---------- 实现 ----------
async function homeContent(filter) {
    const cdata = await apiGet("/api/mw-movie/anonymous/get/filer/type");
    const fdata = await apiGet("/api/mw-movie/anonymous/v1/get/filer/list");
    const classes = [];
    const cd = cdata.data || [];
    for (const k of cd) classes.push({ type_name: k.typeName, type_id: String(k.typeId) });
    const filters = {};
    const sortValues = [{ n: "最近更新", v: "2" }, { n: "人气高低", v: "3" }, { n: "评分高低", v: "4" }];
    const fd = fdata.data || {};
    for (const tid in fd) {
        const d = fd[tid] || {};
        const fl = [];
        const typeList = d.typeList || [];
        const tv = [];
        for (const i of typeList) tv.push({ n: i.itemText, v: i.itemValue });
        fl.push({ key: "type", name: "类型", value: tv });
        const plotList = d.plotList || [];
        if (plotList.length) {
            const pv = [];
            for (const i of plotList) pv.push({ n: i.itemText, v: i.itemText });
            fl.push({ key: "v_class", name: "剧情", value: pv });
        }
        const dv = [];
        for (const i of (d.districtList || [])) dv.push({ n: i.itemText, v: i.itemText });
        fl.push({ key: "area", name: "地区", value: dv });
        const yv = [];
        for (const i of (d.yearList || [])) yv.push({ n: i.itemText, v: i.itemText });
        fl.push({ key: "year", name: "年份", value: yv });
        const lv = [];
        for (const i of (d.languageList || [])) lv.push({ n: i.itemText, v: i.itemText });
        fl.push({ key: "lang", name: "语言", value: lv });
        let sv = sortValues.slice();
        if (tid === "1") sv.shift();
        fl.push({ key: "sort", name: "排序", value: sv });
        filters[tid] = fl;
    }
    return { class: classes, filters: filters };
}

async function homeVod() {
    const data1 = await apiGet("/api/mw-movie/anonymous/v1/home/all/list");
    const data2 = await apiGet("/api/mw-movie/anonymous/home/hotSearch");
    const data = [];
    const d1 = data1.data || {};
    for (const k in d1) {
        const it = d1[k];
        if (it && it.list) data.push.apply(data, it.list);
    }
    const d2 = data2.data;
    if (Array.isArray(d2)) data.push.apply(data, d2);
    return { list: getVod(data) };
}

async function category(tid, pg, filter, extend) {
    const e = extend || {};
    const params = {
        area: e.area || "",
        filterStatus: "1",
        lang: e.lang || "",
        pageNum: pg || "1",
        pageSize: "30",
        sort: e.sort || "1",
        sortBy: "1",
        type: e.type || "",
        type1: tid,
        v_class: e.v_class || "",
        year: e.year || ""
    };
    const data = await apiGet("/api/mw-movie/anonymous/video/list", params);
    const list = (data.data && data.data.list) || [];
    return {
        list: getVod(list),
        page: pg || "1",
        pagecount: 9999,
        limit: 90,
        total: 999999
    };
}

async function detail(ids) {
    const id = Array.isArray(ids) ? ids[0] : ids;
    const data = await apiGet("/api/mw-movie/anonymous/video/detail", { id: id });
    const vod = getVod([data.data])[0];
    if (!vod) return { list: [] };
    vod.vod_play_from = "文采专线";
    const eps = vod.episodelist || [];
    const urls = [];
    for (const i of eps) {
        const name = eps.length > 1 ? (i.name || "") : vod.vod_name;
        urls.push(name + "$" + id + "@@" + i.nid);
    }
    vod.vod_play_url = urls.join("#");
    delete vod.episodelist;
    return { list: [vod] };
}

async function play(flag, id, vipFlags) {
    const parts = String(id).split("@@");
    const vid = parts[0] || "";
    const nid = parts[1] || "";
    const data = await apiGet("/api/mw-movie/anonymous/v2/video/episode/url", { clientType: "1", id: vid, nid: nid });
    const list = (data.data && data.data.list) || [];
    const vlist = [];
    for (const i of list) {
        if (i && i.url) vlist.push(i.resolutionName || "默认", i.url);
    }
    const header = {
        "User-Agent": UA,
        "sec-ch-ua-platform": '"Windows"',
        "DNT": "1",
        "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        "sec-ch-ua-mobile": "?0",
        "Origin": host,
        "Referer": host + "/"
    };
    if (vlist.length) return { parse: 0, url: vlist, header: header };
    return { parse: 1, url: "", header: header };
}

async function search(key, quick, pg) {
    pg = pg || "1";
    const data = await apiGet("/api/mw-movie/anonymous/video/searchByWord", { keyword: key, pageNum: pg, pageSize: "8", sourceCode: "1" });
    const list = (data.data && data.data.result && data.data.result.list) || [];
    return { list: getVod(list), page: pg };
}

export default {
    init: init,
    home: homeContent,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
};