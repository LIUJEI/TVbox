// 枫叶影院/枫叶4K 合并版 - QuickJS 版
const PUBLISH_URL = "https://www.vip1949.com/";
const DEFAULT_SITES = ["https://www.zzztool.com", "https://maihaolian.com", "https://www.cd-zj.com"];
const UA = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/150.0.0.0 Mobile";
const CACHE_MS = 300000;

// 二次解析接口: 线路前缀 -> 解析服务域名
let parseMap = {
    YYNB: "https://zzrs.mfdyvip.com",
    JD4K: "https://fgsrg.hzqingshan.com"
};

let baseUrl = DEFAULT_SITES[0];
let fyCookie = "verify_success=1";
let cacheHost = "", cacheTime = 0;

function init(ext) {
    let e = ext;
    if (typeof e === "string" && e.trim()) {
        try { e = JSON.parse(e); } catch (e2) { e = {}; }
    }
    if (!e || typeof e !== "object") e = {};
    if (e.parse_map && typeof e.parse_map === "object") {
        for (const k in e.parse_map) parseMap[k] = e.parse_map[k];
    }
    if (Array.isArray(e.default_sites) && e.default_sites.length) {
        DEFAULT_SITES.length = 0;
        for (const s of e.default_sites) DEFAULT_SITES.push(s);
        baseUrl = DEFAULT_SITES[0];
    }
    if (e.publish_url) PUBLISH_URL = e.publish_url;
    if (e.cookie) fyCookie = e.cookie;
    if (e.host) baseUrl = String(e.host).replace(/\/$/, "");
}

function headers(referer) {
    const h = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Cookie": fyCookie
    };
    if (referer === undefined) h.Referer = baseUrl + "/";
    else if (referer) h.Referer = referer;
    return h;
}

async function fetchHtml(url, referer) {
    try {
        if (!/^http/.test(url)) url = baseUrl + url;
        const r = await req(url, { headers: headers(referer) });
        const c = (r && r.content) || "";
        return c || "";
    } catch (e) { return ""; }
}

async function fetchJson(url, referer) {
    const t = await fetchHtml(url, referer);
    if (!t) return {};
    try { return JSON.parse(t); } catch (e) { return {}; }
}

function fixPic(u) {
    if (!u) return "";
    if (u.indexOf("//") === 0) return "https:" + u;
    return u.replace(/&amp;/g, "&");
}

// 兼容老版 QuickJS 的 matchAll 替代(全局正则循环 exec)
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

async function checkOnline(url) {
    try {
        const r = await req(url, { headers: headers(), timeout: 5000 });
        const c = (r && r.content) || "";
        return c.length > 500;
    } catch (e) { return false; }
}

async function getOnlineHost() {
    try {
        const r = await req(PUBLISH_URL, { headers: headers("") });
        const html = (r && r.content) || "";
        const m = html.match(/const\s+domains\s*=\s*([\s\S]*?]);/);
        if (m) {
            const js = m[1].replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
            try {
                const domains = JSON.parse(js);
                for (const item of domains) {
                    const u = (item.url || "").replace(/\/$/, "");
                    if (u && (await checkOnline(u))) return u;
                }
            } catch (e) {}
        }
    } catch (e) {}
    return DEFAULT_SITES[0];
}

async function ensureHost() {
    const now = Date.now();
    if (cacheHost && now - cacheTime < CACHE_MS) { baseUrl = cacheHost; return; }
    const host = await getOnlineHost();
    if (host) { baseUrl = host; cacheHost = host; cacheTime = now; }
}

// ---------- 列表解析 ----------
function parseZzzList(html) {
    const videos = [], seen = {};
    // 新结构: <a class="module-poster-item module-item" title="名" href="/detail/x.html">
    const am = matchAllStr(html, /<a[^>]*class="module-poster-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g);
    for (const m of am) {
        const b = m[0];
        const idm = b.match(/\/detail\/(\d+)\.html/);
        if (!idm) continue;
        const vid = idm[1];
        if (seen[vid]) continue;
        let name = "";
        const tm = b.match(/title="([^"]*)"/);
        if (tm) name = tm[1].trim();
        if (!name) {
            const sm = b.match(/class="module-poster-item-title"[^>]*>([^<]+)</);
            if (sm) name = sm[1].trim();
        }
        if (!name) continue;
        const im = b.match(/<img[^>]*data-src="([^"]+)"/);
        const pic = im ? fixPic(im[1]) : "";
        let remarks = "";
        const rm = b.match(/class="module-item-note"[^>]*>([^<]*)</);
        if (rm) remarks = rm[1].trim();
        let year = remarks;
        const vm = b.match(/class="module-item-version-left"[^>]*>([^<]*)</);
        if (vm && vm[1].trim()) year = "「" + vm[1].trim() + "」" + year;
        seen[vid] = 1;
        videos.push({ vod_id: vid, vod_name: name, vod_pic: pic, vod_remarks: remarks, vod_year: year });
    }
    if (videos.length) return videos;
    // 旧结构: div.module-item
    const blocks = html.split(/class="module-item[" ]/);
    for (const b of blocks.slice(1)) {
        const idm = b.match(/\/detail\/(\d+)\.html/);
        if (!idm) continue;
        const vid = idm[1];
        if (seen[vid]) continue;
        let name = "";
        const tm = b.match(/title="([^"]*)"/);
        if (tm) name = tm[1].trim();
        if (!name) {
            const sm = b.match(/<strong[^>]*>([^<]+)<\/strong>/);
            if (sm) name = sm[1].trim();
        }
        if (!name) continue;
        const im = b.match(/<img[^>]*(?:data-src|src)="([^"]+)"/);
        const pic = im ? fixPic(im[1]) : "";
        let remarks = "";
        const rm = b.match(/class="module-item-note"[^>]*>([^<]*)</);
        if (rm) remarks = rm[1].trim();
        let year = remarks;
        const vm = b.match(/class="module-item-version-left"[^>]*>([^<]*)</);
        if (vm && vm[1].trim()) year = "「" + vm[1].trim() + "」" + year;
        seen[vid] = 1;
        videos.push({ vod_id: vid, vod_name: name, vod_pic: pic, vod_remarks: remarks, vod_year: year });
    }
    return videos;
}

function parseFyList(html, isSearch) {
    const videos = [], seen = {};
    const titleMap = {};
    if (isSearch) {
        const rm = matchAllStr(html, /<a[^>]*class="thumb-txt"[^>]*href="[^"]*?\/detail\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g);
        for (const m of rm) titleMap[m[1]] = m[2].replace(/<[^>]+>/g, "").trim();
    }
    const blocks = html.split(/class="public-list-exp[" ]/);
    for (const b of blocks.slice(1)) {
        const idm = b.match(/\/detail\/(\d+)\.html/) || b.match(/href="([^"]*\/detail\/\d+\.html)"/);
        const hm = b.match(/href="([^"]*\/detail\/(\d+)\.html)"/);
        if (!hm) continue;
        const vid = hm[2];
        if (seen[vid]) continue;
        let name = titleMap[vid] || "";
        if (!name) {
            const tm = b.match(/title="([^"]*)"/);
            if (tm) name = tm[1].trim();
        }
        if (!name) {
            const am = b.match(/<img[^>]*alt="([^"]*)"/);
            if (am) name = am[1].trim();
        }
        if (!name) continue;
        const im = b.match(/<img[^>]*data-src="([^"]+)"/);
        const pic = im ? fixPic(im[1]) : "";
        let remarks = "";
        const rm2 = b.match(/class="ft2"[^>]*>([^<]*)</) || b.match(/class="public-list-prb"[^>]*>([^<]*)</);
        if (rm2) remarks = rm2[1].trim();
        let year = "";
        const spans = b.match(/class="public-prt"[^>]*>([^<]*)</g) || [];
        year = spans.map(function (s) { return s.replace(/<[^>]+>/g, "").replace(/class="public-prt"[^>]*>/, "").replace(/<\/span>/, "").trim(); }).filter(function (s) { return s; }).join(",");
        seen[vid] = 1;
        videos.push({ vod_id: vid, vod_name: name, vod_pic: pic, vod_remarks: remarks, vod_year: year });
    }
    return videos;
}

function parseVideoList(html, isHome, isSearch) {
    if (!html || html.indexOf("系统安全验证") >= 0) return [];
    let videos = [];
    if (baseUrl.indexOf("zzztool") >= 0) videos = parseZzzList(html);
    if (!videos.length) videos = parseFyList(html, isSearch);
    else if (isHome && !videos.length) videos = parseFyList(html, isSearch);
    return videos;
}

function parseAjaxList(lst) {
    const videos = [], seen = {};
    for (const it of (lst || [])) {
        if (!it || typeof it !== "object") continue;
        let vid = it.vod_id;
        if (!vid) {
            const m = (it.detail_link || "").match(/\/detail\/(\d+)\.html/);
            if (!m) continue;
            vid = m[1];
        }
        vid = String(vid);
        if (seen[vid]) continue;
        seen[vid] = 1;
        videos.push({
            vod_id: vid,
            vod_name: (it.vod_name || "").trim(),
            vod_pic: fixPic(it.vod_pic || ""),
            vod_remarks: (it.vod_remarks || "").trim(),
            vod_year: (it.vod_year || "").trim()
        });
    }
    return videos;
}

// ---------- 筛选器 ----------
function buildFilters() {
    const area = [{ n: "全部", v: "" }, { n: "大陆", v: "大陆" }, { n: "香港", v: "香港" }, { n: "台湾", v: "台湾" }, { n: "美国", v: "美国" }, { n: "韩国", v: "韩国" }, { n: "日本", v: "日本" }, { n: "泰国", v: "泰国" }, { n: "新加坡", v: "新加坡" }, { n: "马来西亚", v: "马来西亚" }, { n: "印度", v: "印度" }, { n: "英国", v: "英国" }, { n: "法国", v: "法国" }, { n: "加拿大", v: "加拿大" }, { n: "西班牙", v: "西班牙" }, { n: "俄罗斯", v: "俄罗斯" }, { n: "其它", v: "其它" }];
    const cur = new Date().getFullYear();
    const years = [{ n: "全部", v: "" }];
    for (let y = cur; y > cur - 24; y--) years.push({ n: String(y), v: String(y) });
    const lang = [{ n: "全部", v: "" }, { n: "国语", v: "国语" }, { n: "英语", v: "英语" }, { n: "粤语", v: "粤语" }, { n: "闽南语", v: "闽南语" }, { n: "韩语", v: "韩语" }, { n: "日语", v: "日语" }, { n: "法语", v: "法语" }, { n: "德语", v: "德语" }, { n: "其它", v: "其它" }];
    const sort = [{ n: "时间", v: "time" }, { n: "人气", v: "hits" }, { n: "评分", v: "score" }];
    const letter = [{ n: "全部", v: "" }];
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") letter.push({ n: c, v: c });
    letter.push({ n: "0-9", v: "0-9" });
    const opts = function (pairs) { return pairs.map(function (p) { return { n: p[0], v: p[1] }; }); };
    return {
        "2": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "2" }, { n: "国产剧", v: "13" }, { n: "日韩剧", v: "15" }, { n: "海外剧", v: "16" }] },
            { key: "area", name: "地区", value: area },
            { key: "genre", name: "剧情", value: opts([["全部", ""], ["古装", "古装"], ["战争", "战争"], ["青春偶像", "青春偶像"], ["喜剧", "喜剧"], ["家庭", "家庭"], ["犯罪", "犯罪"], ["动作", "动作"], ["奇幻", "奇幻"], ["剧情", "剧情"], ["历史", "历史"], ["经典", "经典"], ["乡村", "乡村"], ["情景", "情景"], ["商战", "商战"], ["网剧", "网剧"], ["其他", "其他"]]) },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ],
        "1": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "1" }, { n: "动作片", v: "6" }, { n: "喜剧片", v: "7" }, { n: "恐怖片", v: "8" }, { n: "科幻片", v: "9" }, { n: "爱情片", v: "10" }, { n: "剧情片", v: "11" }, { n: "战争片", v: "12" }, { n: "纪录片", v: "20" }] },
            { key: "area", name: "地区", value: area },
            { key: "genre", name: "剧情", value: opts([["全部", ""], ["喜剧", "喜剧"], ["爱情", "爱情"], ["恐怖", "恐怖"], ["动作", "动作"], ["科幻", "科幻"], ["剧情", "剧情"], ["战争", "战争"], ["警匪", "警匪"], ["犯罪", "犯罪"], ["动画", "动画"], ["奇幻", "奇幻"], ["武侠", "武侠"], ["冒险", "冒险"], ["枪战", "枪战"], ["悬疑", "悬疑"], ["惊悚", "惊悚"], ["经典", "经典"], ["青春", "青春"], ["文艺", "文艺"], ["微电影", "微电影"], ["古装", "古装"], ["历史", "历史"], ["运动", "运动"], ["农村", "农村"], ["儿童", "儿童"], ["网络电影", "网络电影"]]) },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ],
        "4": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "4" }, { n: "国产动漫", v: "25" }, { n: "日韩动漫", v: "26" }] },
            { key: "genre", name: "剧情", value: opts([["全部", ""], ["情感", "情感"], ["科幻", "科幻"], ["热血", "热血"], ["推理", "推理"], ["搞笑", "搞笑"], ["冒险", "冒险"], ["奇幻", "奇幻"], ["战斗", "战斗"], ["校园", "校园"], ["萝莉", "萝莉"], ["治愈", "治愈"], ["原创", "原创"], ["亲子", "亲子"], ["益智", "益智"], ["励志", "励志"], ["其他", "其他"]]) },
            { key: "area", name: "地区", value: area },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ],
        "3": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "3" }, { n: "大陆综艺", v: "21" }, { n: "日韩综艺", v: "22" }] },
            { key: "genre", name: "剧情", value: opts([["全部", ""], ["选秀", "选秀"], ["情感", "情感"], ["访谈", "访谈"], ["播报", "播报"], ["音乐", "音乐"], ["美食", "美食"], ["旅游", "旅游"], ["搞笑", "搞笑"], ["游戏", "游戏"], ["亲子", "亲子"], ["其它", "其它"]]) },
            { key: "area", name: "地区", value: area },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ]
    };
}

// ---------- 接口 ----------
async function home(filter) {
    await ensureHost();
    return JSON.stringify({
        class: [
            { type_id: "/label/qq", type_name: "腾讯VIP精选" },
            { type_id: "/label/bli", type_name: "B站VIP精选" },
            { type_id: "/label/youku", type_name: "优酷VIP精选" },
            { type_id: "2", type_name: "电视剧" },
            { type_id: "1", type_name: "电影" },
            { type_id: "4", type_name: "动漫" },
            { type_id: "3", type_name: "综艺" },
            { type_id: "5", type_name: "热门短剧" }
        ],
        filters: buildFilters()
    });
}

async function homeVod() {
    await ensureHost();
    const html = await fetchHtml("/");
    return JSON.stringify({ list: html ? parseVideoList(html, true) : [] });
}

async function category(tid, pg, filter, extend) {
    await ensureHost();
    const page = parseInt(pg) || 1;
    tid = String(tid);
    const isLabel = tid.indexOf("/label") === 0;
    let ext = extend;
    if (typeof ext === "string" && ext.trim()) {
        try { ext = JSON.parse(ext); } catch (e) { ext = {}; }
    }
    if (!ext || typeof ext !== "object") ext = {};
    const args = {};
    for (const k in ext) if (ext[k]) args[k] = String(ext[k]);
    const routeTid = args.class || tid;

    // VIP 标签页: HTML 分页
    if (isLabel) {
        const html = await fetchHtml(tid + "/page/" + page + ".html");
        if (!html || html.indexOf("系统安全验证") >= 0) {
            return JSON.stringify({ list: [], page: page, pagecount: 0, limit: 24, total: 0 });
        }
        const items = parseVideoList(html);
        const total = items.length < 24 ? page : page + 2;
        return JSON.stringify({ list: items, page: page, pagecount: total, limit: 24, total: total * 24 });
    }
    const useTid = routeTid;

    // 数字分类: ajax/data JSON (绕验证码)
    const limit = 20;
    let url = "/index.php/ajax/data?mid=1&tid=" + encodeURIComponent(useTid) + "&page=" + page + "&limit=" + limit;
    const area = args.area || "", year = args.year || "", lang = args.lang || "", letter = args.letter || "", sort = args.sort || "";
    if (area) url += "&area=" + encodeURIComponent(area);
    if (year) url += "&year=" + encodeURIComponent(year);
    if (lang) url += "&lang=" + encodeURIComponent(lang);
    if (letter) url += "&letter=" + encodeURIComponent(letter);
    if (sort) url += "&by=" + encodeURIComponent(sort);
    const data = await fetchJson(url);
    if (data && data.list && data.list.length) {
        return JSON.stringify({
            list: parseAjaxList(data.list),
            page: page,
            pagecount: parseInt(data.pagecount) || page,
            limit: parseInt(data.limit) || limit,
            total: parseInt(data.total) || 0
        });
    }
    // 兜底: HTML 分类路由
    const prefix = baseUrl.indexOf("zzztool") >= 0 ? "list" : "cupfox-list";
    if (!(area || year || lang || letter || sort)) {
        url = "/" + prefix + "/" + useTid + "--------" + page + "---.html";
    } else {
        url = "/" + prefix + "/" + useTid + "-" + area + "-" + sort + "-" + lang + "-" + letter + "--" + page + "---" + year + ".html";
    }
    const html = await fetchHtml(url);
    const items = parseVideoList(html);
    let pagecount = page;
    if (html && html.indexOf("系统安全验证") < 0) {
        const tm = html.match(/page-link[^>]*href="[^"]*---(\d+)---[^"]*"[^>]*>\s*尾页/);
        if (tm) pagecount = parseInt(tm[1]);
    }
    if (!items.length) pagecount = 0;
    return JSON.stringify({ list: items, page: page, pagecount: pagecount, limit: 36, total: 9999 });
}

async function detail(ids) {
    await ensureHost();
    const vid = String(Array.isArray(ids) ? ids[0] : ids).split(",")[0].trim();
    const html = await fetchHtml("/detail/" + vid + ".html");
    if (!html) return JSON.stringify({ list: [] });
    const isZzz = baseUrl.indexOf("zzztool") >= 0;
    let vodName = "", vodPic = "", director = "", actor = "", vodContent = "";
    const playFrom = [], playUrl = [];
    if (isZzz) {
        let m = html.match(/class="module-info-heading[^>]*>\s*<h1[^>]*>([^<]+)</);
        if (m) vodName = m[1].trim();
        if (!vodName) { m = html.match(/<h1[^>]*>([^<]+)<\/h1>/); if (m) vodName = m[1].trim(); }
        if (!vodName) { m = html.match(/<img[^>]*alt="([^"]+)"[^>]*onerror=/); if (m) vodName = m[1].trim(); }
        m = html.match(/class="module-item-pic[^>]*>\s*<img[^>]*(?:data-src|src)="([^"]+)"/);
        if (m) vodPic = fixPic(m[1]);
        const blocks = html.match(/<div class="module-info-item[\s\S]*?<\/div>\s*<\/div>/g) || [];
        for (const b of blocks) {
            const tm = b.match(/class="module-info-item-title"[^>]*>([^<]+)</);
            const cm = b.match(/class="module-info-item-content"[^>]*>([\s\S]*?)<\/div>/);
            if (!tm || !cm) continue;
            const tt = tm[1].trim(), cc = cm[1].replace(/<[^>]+>/g, "").trim();
            if (tt.indexOf("导演") >= 0) director = cc;
            else if (tt.indexOf("主演") >= 0) actor = cc;
        }
        const cm2 = html.match(/class="module-info-introduction-content[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/);
        if (cm2) vodContent = cm2[1].replace(/<[^>]+>/g, "").trim();
        const nameCounts = {};
        const tabs = matchAllStr(html, /class="mx-anthology-tab-label"[^>]*>([^<]*)</g);
        for (const t of tabs) {
            const raw = (t[1] || "").replace(/(?:&amp;|&)nbsp;/gi, " ").replace(/\s+/g, " ").trim().replace(/\d+$/, "").trim();
            if (!raw) continue;
            nameCounts[raw] = (nameCounts[raw] || 0) + 1;
            playFrom.push(nameCounts[raw] > 1 ? raw + "-" + nameCounts[raw] : raw);
        }
        const panels = html.split(/class="mx-anthology-panel[" ]/).slice(1);
        for (const p of panels) {
            const eps = [];
            const am = matchAllStr(p, /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
            for (const a of am) {
                const title = a[2].replace(/<[^>]+>/g, "").trim();
                if (title && a[1]) eps.push(title + "$" + a[1]);
            }
            if (eps.length) playUrl.push(eps.reverse().join("#"));
        }
    } else {
        let m = html.match(/class="slide-info-title[^"]*"[^>]*>([^<]+)</);
        if (m) vodName = m[1].trim();
        if (!vodName) { m = html.match(/<h1[^>]*>([^<]+)<\/h1>/); if (m) vodName = m[1].trim(); }
        if (!vodName) {
            m = html.match(/<title>([^<]+)<\/title>/);
            if (m) {
                const bm = m[1].match(/《([^》]+)》/);
                vodName = (bm ? bm[1] : m[1].split("_")[0]).trim();
            }
        }
        m = html.match(/<img[^>]*class="[^"]*lazy[^"]*"[^>]*data-src="([^"]+)"/) || html.match(/<img[^>]*data-src="([^"]+)"[^>]*class="[^"]*lazy[^"]*"/);
        if (m) vodPic = fixPic(m[1]);
        const sblocks = html.match(/<div class="slide-info[\s\S]*?<\/div>/g) || [];
        for (const b of sblocks) {
            const t = b.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (t.indexOf("导演：") === 0) director = t.replace("导演：", "").trim();
            else if (t.indexOf("演员：") === 0) actor = t.replace("演员：", "").trim();
        }
        const cm = html.match(/id="height_limit"[^>]*>([\s\S]*?)<\/div>/);
        if (cm) vodContent = cm[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const nameCounts = {};
        const tabs = html.match(/<a[^>]*class="swiper-slide[^"]*"[^>]*>[\s\S]*?<\/a>/g) || [];
        for (const t of tabs) {
            let raw = t.replace(/<span class="badge">[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "").replace(/(?:&amp;|&)nbsp;/gi, " ").replace(/\s+/g, " ").trim().replace(/[（(]\d+[）)]$/, "").replace(/\d+$/, "").trim();
            if (!raw) continue;
            nameCounts[raw] = (nameCounts[raw] || 0) + 1;
            playFrom.push(nameCounts[raw] > 1 ? raw + "-" + nameCounts[raw] : raw);
        }
        const blocks = html.split(/class="anthology-list-box[" ]/).slice(1);
        for (const b of blocks) {
            const eps = [];
            const am = matchAllStr(b, /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
            for (const a of am) {
                const pm = a[1].match(/\/play\/(.*?)\.html/);
                if (pm) {
                    let ep = pm[1];
                    if (ep.indexOf(vid + "-") !== 0) ep = vid + "-" + ep;
                    eps.push(a[2].replace(/<[^>]+>/g, "").trim() + "$" + ep);
                }
            }
            if (eps.length) playUrl.push(eps.reverse().join("#"));
        }
    }
    const validFrom = playFrom.filter(function (pf, i) { return i < playUrl.length; });
    return JSON.stringify({
        list: [{
            vod_id: vid,
            vod_name: vodName,
            vod_pic: vodPic,
            vod_director: director,
            vod_actor: actor,
            vod_content: "【琉🔹璃❤广告勿信👉剧情】📢" + vodContent,
            vod_play_from: validFrom.join("$$$"),
            vod_play_url: playUrl.join("$$$")
        }]
    });
}

async function resolveVideoUrl(videoUrl, playId) {
    const lineKey = playId || videoUrl.split(/[-_]/)[0];
    // fallback 链: 线路专属 -> YYNB -> JD4K, 逐个试
    const chain = [];
    if (parseMap[lineKey]) chain.push(parseMap[lineKey]);
    if (parseMap.YYNB) chain.push(parseMap.YYNB);
    chain.push(parseMap.JD4K || "https://fgsrg.hzqingshan.com");
    for (const baseDomain of chain) {
        try {
            // 1) 拿 token
            const tokenPage = await fetchHtml(baseDomain + "/player/?url=" + encodeURIComponent(videoUrl), baseUrl);
            if (!tokenPage) continue;
            let token = "";
            const tm = tokenPage.match(/data-te="([^"]+)"/);
            if (tm) token = tm[1];
            else {
                const em = tokenPage.match(/id="player-data"[\s\S]*?data-te="([^"]+)"/);
                if (em) token = em[1];
            }
            if (!token) continue;
            // 2) 换取真实地址
            const rh = headers(baseUrl);
            rh["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
            const r = await req(baseDomain + "/player/mplayer.php", {
                method: "POST",
                headers: rh,
                data: { url: videoUrl, token: token },
                postType: "form"
            });
            const data = JSON.parse((r && r.content) || "{}");
            let finalUrl = data.url || "";
            if (!finalUrl) continue;
            if (finalUrl.indexOf("/playproxy.php") === 0) finalUrl = baseDomain + finalUrl;
            return finalUrl;
        } catch (e) {}
    }
    throw new Error("所有解析服务均失效");
}

async function play(flag, id, flags) {
    let playUrl = String(id);
    let playPath = playUrl.indexOf("$") >= 0 ? playUrl.split("$").pop() : playUrl;
    try {
        if (/^http/.test(playPath) && (/\.m3u8/.test(playPath) || /\.mp4/.test(playPath))) {
            return JSON.stringify({ parse: 0, url: playPath, header: headers() });
        }
        let videoUrl = "";
        if (/^http/.test(playPath)) {
            videoUrl = playPath;
        } else {
            let purl;
            if (playPath.indexOf("/play/") === 0) purl = baseUrl + playPath;
            else purl = baseUrl + "/play/" + playPath + ".html";
            purl = purl.replace(".html.html", ".html");
            const html = await fetchHtml(purl);
            if (!html) return JSON.stringify({ parse: 0, url: "", msg: "播放页获取失败" });
            const m = html.match(/player_aaaa=([\s\S]*?)<\/script>/);
            let playId = "";
            if (m) {
                try {
                    const pd = JSON.parse(m[1]);
                    videoUrl = pd.url || "";
                    playId = pd.from || "";
                } catch (e) {}
            }
            if (!videoUrl) {
                const m2 = html.match(/var\s+player_aaaa[\s\S]*?"url"\s*:\s*"([^"]+)"/);
                if (m2) videoUrl = m2[1].replace(/\\/g, "");
            }
            if (!videoUrl) {
                const m3 = html.match(/<video[^>]+src="([^"]+)"/i);
                if (m3) videoUrl = m3[1];
            }
            if (!videoUrl) {
                const m4 = html.match(/<iframe[^>]+src="([^"]+)"/i);
                if (m4) videoUrl = m4[1];
            }
            if (!videoUrl) {
                const m5 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/);
                if (m5) videoUrl = m5[1];
            }
            if (!videoUrl) return JSON.stringify({ parse: 0, url: "", msg: "未找到视频地址" });
            if (/^http/.test(videoUrl) && (/\.m3u8/.test(videoUrl) || /\.mp4/.test(videoUrl))) {
                return JSON.stringify({ parse: 0, url: videoUrl, header: headers(baseUrl) });
            }
            const finalUrl = await resolveVideoUrl(videoUrl, playId);
            // 解析站直链: Referer 用解析站自身域名, 其余不带 Referer 避免 CDN 校验失败
            let ref = "";
            const om = finalUrl.match(/^https?:\/\/[^\/]+/);
            if (om && (finalUrl.indexOf("playproxy") >= 0 || om[0].indexOf("mfdyvip") >= 0 || om[0].indexOf("hzqingshan") >= 0)) ref = om[0];
            const ph = { "User-Agent": UA };
            if (ref) ph.Referer = ref;
            return JSON.stringify({ parse: 0, url: finalUrl, header: ph });
        }
        // 网页型地址交壳内置嗅探
        return JSON.stringify({ parse: 1, url: videoUrl, header: headers(baseUrl) });
    } catch (e) {
        return JSON.stringify({ parse: 1, url: /^http/.test(playPath) ? playPath : baseUrl + "/play/" + playPath + ".html", msg: String(e.message || e) });
    }
}

async function search(wd, quick, pg) {
    await ensureHost();
    const page = parseInt(pg) || 1;
    const kw = encodeURIComponent(wd);
    // 1) suggest JSON
    const data = await fetchJson("/index.php/ajax/suggest?mid=1&wd=" + kw + "&limit=50");
    const items = [];
    if (data && data.list) {
        for (const it of data.list) {
            if (!it || typeof it !== "object" || !it.id) continue;
            items.push({
                vod_id: String(it.id),
                vod_name: (it.name || "").trim(),
                vod_pic: fixPic(it.pic || ""),
                vod_remarks: (it.remarks || "").trim()
            });
        }
        if (items.length) {
            return JSON.stringify({ list: items, page: page, pagecount: 1, limit: 50, total: items.length });
        }
    }
    // 2) HTML 兜底
    const prefix = baseUrl.indexOf("zzztool") >= 0 ? "search" : "cupfox-search";
    const html = await fetchHtml("/" + prefix + "/-------------.html?wd=" + kw);
    if (html && html.indexOf("系统安全验证") < 0) {
        const items2 = parseVideoList(html, false, true);
        return JSON.stringify({ list: items2, page: page, pagecount: 1, limit: 36, total: items2.length });
    }
    return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 50, total: 0 });
}

export default { init, home, homeVod, category, detail, play, search };