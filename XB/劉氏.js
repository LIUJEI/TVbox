// 劉氏影院 (agoys.com) - QuickJS 版 
const DOMAIN_CANDIDATES = ["https://agoys.com", "https://www.agoys.com"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DOMAIN_TTL = 1800000; // 域名探活缓存30分钟

let customBase = "";      // ext 手动指定域名
let cacheBase = "", cacheTs = 0;

// ---------- 筛选配置 (与站点 /filter/ 选项一致) ----------
const CLASS_LIST = [["电影", "film"], ["剧集", "tvseries"], ["综艺", "varietyshow"], ["动漫", "anime"], ["短剧", "shortplay"]];
const GENRES_21 = { "剧情": "1", "喜剧": "2", "动作": "3", "爱情": "4", "科幻": "5", "悬疑": "6", "惊悚": "7", "恐怖": "8", "犯罪": "9", "同性": "10", "音乐": "11", "歌舞": "12", "传记": "13", "历史": "14", "战争": "15", "西部": "16", "奇幻": "17", "冒险": "18", "灾难": "19", "武侠": "20", "伦理": "21" };
const TYPE_MAPS = {
    film: GENRES_21,
    tvseries: GENRES_21,
    anime: GENRES_21,
    varietyshow: { "真人秀": "1", "脱口秀": "2", "纪录片": "3", "传记": "4", "歌舞": "5" },
    shortplay: { "剧情": "1", "喜剧": "2", "动作": "3", "爱情": "4", "科幻": "5", "悬疑": "6", "惊悚": "7", "恐怖": "8" }
};
const AREA_FULL = { "中国大陆": "1", "美国": "2", "香港": "3", "台湾": "4", "日本": "5", "韩国": "6", "英国": "7", "法国": "8", "德国": "9", "意大利": "10", "西班牙": "11", "印度": "12", "泰国": "13", "俄罗斯": "14", "伊朗": "15", "加拿大": "16", "澳大利亚": "17", "爱尔兰": "18", "瑞典": "19", "巴西": "20", "丹麦": "21" };
const AREA_MAPS = {
    film: AREA_FULL,
    tvseries: AREA_FULL,
    varietyshow: { "中国大陆": "1", "美国": "2", "香港": "3", "台湾": "4", "日本": "5", "韩国": "6" },
    anime: { "中国大陆": "1", "美国": "2", "日本": "3", "韩国": "4" },
    shortplay: { "中国大陆": "1" }
};
const YEAR_OPTIONS = (function () {
    const out = [["全部", "0"]];
    for (let y = 2026; y >= 2005; y--) out.push([String(y), String(y)]);
    out.push(["其他", "1"]);
    return out;
})();
const SORT_OPTIONS = [["新上线", "0"], ["热播榜", "1"], ["好评榜", "2"]];

// ---------- 工具 ----------
function matchAllStr(str, re) {
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(str)) !== null) {
        out.push(m);
        if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
}

function unesc(s) {
    return s.replace(/\\(.)/g, function (m, c) {
        if (c === "n") return "\n";
        if (c === "t") return "\t";
        if (c === "r") return "\r";
        return c;
    });
}

// 平衡括号提取: text[start] 必须是 [ 或 {, 返回完整闭合文本(支持字符串内括号)
function extractBalanced(text, start) {
    const open = text.charAt(start);
    const close = open === "[" ? "]" : "}";
    let depth = 0, inStr = "", esc = false;
    for (let i = start; i < text.length; i++) {
        const c = text.charAt(i);
        if (inStr) {
            if (esc) esc = false;
            else if (c === "\\") esc = true;
            else if (c === inStr) inStr = "";
        } else {
            if (c === "'" || c === '"') inStr = c;
            else if (c === open) depth++;
            else if (c === close) {
                depth--;
                if (depth === 0) return text.substring(start, i + 1);
            }
        }
    }
    return "";
}

// ---------- 域名探活: 首页200且含特征词 ----------
async function domainOk(dom) {
    try {
        const r = await req(dom + "/", { headers: headers() });
        const c = ((r && r.content) || "").substring(0, 6000);
        return c.indexOf("ago") >= 0 || c.indexOf("影院") >= 0;
    } catch (e) { return false; }
}

async function resolveBase() {
    const now = Date.now();
    if (cacheBase && now - cacheTs < DOMAIN_TTL) return cacheBase;
    const cands = [];
    if (customBase) cands.push(customBase);
    for (const d of DOMAIN_CANDIDATES) cands.push(d);
    for (const dom of cands) {
        if (await domainOk(dom)) { cacheBase = dom; cacheTs = now; return dom; }
    }
    const fb = cacheBase || DOMAIN_CANDIDATES[0];
    cacheBase = fb; cacheTs = now;
    return fb;
}

async function ensureBase() {
    if (cacheBase && Date.now() - cacheTs < DOMAIN_TTL) return;
    await resolveBase();
}

function headers() {
    return {
        "User-Agent": UA,
        "Referer": (cacheBase || customBase || DOMAIN_CANDIDATES[0]) + "/",
        "X-Requested-With": "XMLHttpRequest"
    };
}

async function fetchText(url) {
    try {
        const r = await req(url, { headers: headers() });
        return (r && r.content) || "";
    } catch (e) { return ""; }
}

async function fetchJson(url) {
    const t = await fetchText(url);
    if (!t) return null;
    try { return JSON.parse(t); } catch (e) { return null; }
}

// init 必须同步
function init(ext) {
    let e = ext;
    if (typeof e === "string") {
        const s = e.trim();
        if (s.indexOf("{") === 0) {
            try { e = JSON.parse(s); } catch (e2) { e = {}; }
        } else if (s.indexOf("http") === 0) {
            customBase = s.replace(/\/+$/, "");
            return;
        } else e = {};
    }
    if (e && typeof e === "object" && e.domain) {
        const d = String(e.domain).trim();
        if (d.indexOf("http") === 0) customBase = d.replace(/\/+$/, "");
    }
}

// ---------- 筛选构建 ----------
function kv(head, mapping) {
    const out = [];
    for (const p of head) out.push({ n: p[0], v: p[1] });
    for (const k in mapping) out.push({ n: k, v: mapping[k] });
    return out;
}

function buildFilters() {
    const filters = {};
    for (const c of CLASS_LIST) {
        const tid = c[1];
        filters[tid] = [
            { key: "type", name: "类型", value: kv([["全部", "0"]], TYPE_MAPS[tid]) },
            { key: "area", name: "地区", value: kv([["全部", "0"]], AREA_MAPS[tid]) },
            { key: "year", name: "年份", value: YEAR_OPTIONS.map(function (p) { return { n: p[0], v: p[1] }; }) },
            { key: "sort", name: "排序", value: SORT_OPTIONS.map(function (p) { return { n: p[0], v: p[1] }; }) }
        ];
    }
    return filters;
}

// extend -> 'type-area-year-sort'
function extString(extend) {
    if (extend) {
        if (typeof extend === "string") {
            const s = extend.trim();
            if (/^\d+(-\d+){0,3}$/.test(s)) {
                const parts = s.split("-");
                while (parts.length < 4) parts.push("0");
                return parts.slice(0, 4).join("-");
            }
            if (s.indexOf("{") === 0) {
                try { extend = JSON.parse(s); } catch (e) { extend = {}; }
            }
        }
        if (extend && typeof extend === "object") {
            const keys = ["type", "area", "year", "sort"];
            const parts = [];
            for (const k of keys) parts.push(String(extend[k] || "0"));
            return parts.join("-");
        }
    }
    return "0-0-0-0";
}

// ---------- 解析: 首页/筛选页卡片 ----------
function parseGridCards(html) {
    const cards = [], seen = {};
    const marks = matchAllStr(html, /<div class="flex flex-col items-center desktop-hover-effect">/g);
    for (let i = 0; i < marks.length; i++) {
        const st = marks[i].index;
        const end = i + 1 < marks.length ? marks[i + 1].index : Math.min(html.length, st + 9000);
        const seg = html.substring(st, end);
        const href = seg.match(/href="\/(film|tvseries|varietyshow|anime|shortplay)\/(\d+)"/);
        if (!href) continue;
        const vid = href[1] + "-" + href[2];
        if (seen[vid]) continue;
        const title = seg.match(/font-bold">([^<]+)</);
        if (!title) continue;
        const pic = seg.match(/src="(https?:\/\/[^"]+)"/);
        const note = seg.match(/class="text-xs truncate">\s*([^<]+?)\s*</);
        seen[vid] = 1;
        cards.push({
            vod_id: vid,
            vod_name: title[1].trim(),
            vod_pic: pic ? pic[1].trim() : "",
            vod_remarks: note ? note[1].trim() : ""
        });
    }
    return cards;
}

// ---------- 解析: 搜索结果卡片 ----------
function parseSearchCards(html) {
    const cards = [], seen = {};
    const marks = matchAllStr(html, /<div class="col-lg-6 col-md-12 mt-2 mb-2 cursor-pointer"><a\s+href="\/(film|tvseries|varietyshow|anime|shortplay)\/(\d+)"/g);
    for (let i = 0; i < marks.length; i++) {
        const st = marks[i].index;
        const end = i + 1 < marks.length ? marks[i + 1].index : Math.min(html.length, st + 9000);
        const seg = html.substring(st, end);
        const vid = marks[i][1] + "-" + marks[i][2];
        if (seen[vid]) continue;
        const title = seg.match(/<div class="topic-details-title">([^<]*)<\/div>/);
        if (!title || !title[1].trim()) continue;
        const pic = seg.match(/<img[^>]*src="(https?:\/\/[^"]+)"/);
        const meta = seg.match(/class="topic-details-title-sub text-secondary "\s*>\s*(\d{4}[^<]{0,80})/);
        seen[vid] = 1;
        cards.push({
            vod_id: vid,
            vod_name: title[1].trim(),
            vod_pic: pic ? pic[1].trim() : "",
            vod_remarks: meta ? meta[1].replace(/\s+/g, " ").trim() : ""
        });
    }
    return cards;
}

// ---------- 解析: JSON 列表项 (筛选/搜索第2页起) ----------
function jsonItem(x) {
    if (!x || typeof x !== "object") return null;
    const m = String(x.url || "").match(/\/(film|tvseries|varietyshow|anime|shortplay)\/(\d+)/);
    if (!m) return null;
    const title = String(x.title || "").trim();
    if (!title) return null;
    let note = String(x.note || "").trim();
    if (!note) note = (String(x.year || "").trim() + " " + String(x.label || "").trim()).trim();
    return { vod_id: m[1] + "-" + m[2], vod_name: title, vod_pic: String(x.image || "").trim(), vod_remarks: note };
}

// ---------- 解析: urlList 字面量 ----------
function parseQuotedArray(text) {
    const out = [];
    const ms = matchAllStr(text, /'((?:[^'\\]|\\.)*)'/g);
    for (const m of ms) out.push(unesc(m[1]));
    return out;
}

function parseUrlList(lit) {
    // lit: {'source': [...], 'url_list': [[{...},...],...]}
    const sources = [];
    const sm = lit.match(/['"]?source['"]?\s*:/);
    if (sm) {
        const bIdx = lit.indexOf("[", sm.index + sm[0].length);
        if (bIdx >= 0) {
            const arrText = extractBalanced(lit, bIdx);
            if (arrText) {
                const arr = parseQuotedArray(arrText);
                for (const s of arr) sources.push(s);
            }
        }
    }
    const lines = [];
    const um = lit.match(/['"]?url_list['"]?\s*:/);
    if (um) {
        const bIdx = lit.indexOf("[", um.index + um[0].length);
        if (bIdx >= 0) {
            const outer = extractBalanced(lit, bIdx);
            if (outer) {
                // 切出顶层每个子数组
                let i = 0;
                while (i < outer.length) {
                    const c = outer.charAt(i);
                    if (c === "[") {
                        const sub = extractBalanced(outer, i);
                        if (!sub) break;
                        const eps = [];
                        const objs = matchAllStr(sub, /\{[^{}]*\}/g);
                        for (const o of objs) {
                            const tm = o[0].match(/['"]?title['"]?\s*:\s*'((?:[^'\\]|\\.)*)'/);
                            // sid 兼容裸数字与单引号字符串两种格式
                            const sm2 = o[0].match(/['"]?sid['"]?\s*:\s*(?:'((?:[^'\\]|\\.)*)'|(\d+))/);
                            const name = tm ? unesc(tm[1]).trim().replace(/[$#]/g, " ") : "";
                            const sid = sm2 ? String(sm2[1] !== undefined ? sm2[1] : sm2[2]).trim() : "";
                            if (name && sid) eps.push(name + "$" + sid);
                        }
                        lines.push(eps);
                        i += sub.length;
                    } else i++;
                }
            }
        }
    }
    return { sources: sources, lines: lines };
}

// ---------- 解析: 详情页 ----------
function parseDetail(html, vid) {
    const raw = String(vid).split("-").pop();
    const fields = {};
    // 站点部分 var 语句末尾无分号, 分号改为可选
    const vms = matchAllStr(html, /var (\w+) = ('(?:[^'\\]|\\.)*'|[-\d.]+|true|false|null)\s*;?/g);
    for (const m of vms) {
        const name = m[1], rv = m[2];
        if (rv.charAt(0) === "'") fields[name] = unesc(rv.substring(1, rv.length - 1));
        else fields[name] = rv;
    }
    if (!fields.title) return null;

    const playFrom = [], playUrl = [];
    // 平衡括号提取 urlList 字面量, 比正则更稳
    const ulIdx = html.indexOf("var urlList");
    if (ulIdx >= 0) {
        const bIdx = html.indexOf("{", ulIdx);
        const lit = bIdx >= 0 ? extractBalanced(html, bIdx) : "";
        const parsed = lit ? parseUrlList(lit) : { sources: [], lines: [] };
        for (let i = 0; i < parsed.sources.length; i++) {
            const eps = i < parsed.lines.length ? parsed.lines[i] : [];
            if (!eps.length) continue;
            playFrom.push(String(parsed.sources[i]));
            playUrl.push(eps.join("#"));
        }
    }
    return {
        vod_id: String(raw),
        vod_name: fields.title || "",
        vod_pic: fields.pic || "",
        type_name: fields.label || "",
        vod_year: fields.year || "",
        vod_area: fields.area || "",
        vod_remarks: fields.note || "",
        vod_actor: fields.actor || "",
        vod_director: fields.director || "",
        vod_content: fields.description || "",
        vod_play_from: playFrom.join("$$$"),
        vod_play_url: playUrl.join("$$$")
    };
}

// ---------- 播放: POST /source/ 直出 m3u8 ----------
async function fetchSource(sid) {
    const base = await resolveBase();
    try {
        const h = headers();
        h["Content-Type"] = "application/x-www-form-urlencoded";
        const r = await req(base + "/source/", {
            method: "POST",
            data: { id: sid },
            postType: "form",
            headers: h
        });
        return ((r && r.content) || "").trim();
    } catch (e) { return ""; }
}

// ---------- 接口实现 ----------
async function homeContent(filter) {
    await ensureBase();
    const result = { class: [], filters: buildFilters(), list: [] };
    for (const c of CLASS_LIST) result.class.push({ type_id: c[1], type_name: c[0] });
    try {
        const base = await resolveBase();
        const html = await fetchText(base + "/");
        result.list = parseGridCards(html).slice(0, 40);
    } catch (e) {}
    return JSON.stringify(result);
}

async function homeVod() {
    await ensureBase();
    try {
        const base = await resolveBase();
        const html = await fetchText(base + "/");
        const cards = parseGridCards(html);
        return JSON.stringify({ list: cards.slice(0, 12) });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

async function category(tid, pg, filter, extend) {
    await ensureBase();
    const page = /^\d+$/.test(String(pg || "")) ? parseInt(pg, 10) : 1;
    const ext = extString(extend);
    const base = await resolveBase();
    let vods = [];
    try {
        if (page <= 1) {
            const html = await fetchText(base + "/filter/" + tid + "/" + ext);
            vods = parseGridCards(html);
        } else {
            const data = await fetchJson(base + "/filter/" + tid + "/" + ext + "?page=" + page);
            const lst = (data && data.list) || [];
            for (const x of lst) { const v = jsonItem(x); if (v) vods.push(v); }
        }
    } catch (e) {}
    return JSON.stringify({ list: vods, page: page, pagecount: vods.length ? page + 1 : page, limit: vods.length, total: vods.length });
}

async function detail(ids) {
    await ensureBase();
    const raw = String(Array.isArray(ids) ? ids[0] : ids || "");
    if (!raw) return JSON.stringify({ list: [] });
    let pairs = [];
    if (raw.indexOf("-") >= 0) {
        const idx = raw.indexOf("-");
        pairs = [[raw.substring(0, idx), raw.substring(idx + 1)]];
    } else {
        pairs = [["film", raw], ["tvseries", raw], ["anime", raw], ["varietyshow", raw]];
    }
    const base = await resolveBase();
    for (const pr of pairs) {
        try {
            const html = await fetchText(base + "/" + pr[0] + "/" + pr[1]);
            const vod = parseDetail(html, pr[1]);
            if (vod) return JSON.stringify({ list: [vod] });
        } catch (e) {}
    }
    return JSON.stringify({ list: [] });
}

async function play(flag, id, vipFlags) {
    await ensureBase();
    const header = { "User-Agent": UA };
    try {
        const sid = String(id).trim();
        let url = await fetchSource(sid);
        if (!url || url.indexOf("http") !== 0) {
            // 域名可能失效: 强制重探活再试一次
            cacheTs = 0;
            await resolveBase();
            url = await fetchSource(sid);
        }
        if (url && url.indexOf("http") === 0) return JSON.stringify({ parse: 0, url: url, header: header });
    } catch (e) {}
    return JSON.stringify({ parse: 1, url: "", header: header });
}

async function search(key, quick, pg) {
    await ensureBase();
    const page = /^\d+$/.test(String(pg || "")) ? parseInt(pg, 10) : 1;
    const base = await resolveBase();
    let vods = [];
    try {
        if (page <= 1) {
            const html = await fetchText(base + "/search?wd=" + encodeURIComponent(String(key)));
            vods = parseSearchCards(html);
        } else {
            const data = await fetchJson(base + "/search?wd=" + encodeURIComponent(String(key)) + "&page=" + page);
            const lst = (data && data.list) || [];
            for (const x of lst) { const v = jsonItem(x); if (v) vods.push(v); }
        }
    } catch (e) {}
    return JSON.stringify({ list: vods, page: page, pagecount: vods.length ? page + 1 : page, limit: vods.length, total: vods.length });
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
