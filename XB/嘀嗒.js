// 嘀嗒影视 (didahd.xyz) - QuickJS 版
const HOST = "https://www.didahd.xyz";
const UA = "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

const HEADERS = {
    "User-Agent": UA,
    "Referer": HOST + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

async function getHtml(url, referer) {
    if (!url.startsWith("http")) url = HOST + (url.startsWith("/") ? url : "/" + url);
    const h = Object.assign({}, HEADERS);
    if (referer) h["Referer"] = referer;
    const r = await req(url, { headers: h });
    return (r && r.content) || "";
}

async function postJson(url, jsonStr, referer) {
    const h = Object.assign({}, HEADERS, {
        "Content-Type": "application/json",
        "Accept": "application/json,text/plain,*/*",
        "Origin": HOST
    });
    if (referer) h["Referer"] = referer;
    const r = await req(url, { method: "POST", headers: h, data: tryParse(jsonStr), postType: "json" });
    return (r && r.content) || "";
}

function tryParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

function clean(s) {
    if (!s) return "";
    s = String(s);
    s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
    s = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
    s = s.replace(/<[^>]+>/g, " ");
    return s.replace(/\s+/g, " ").trim();
}

function fix(u) {
    if (!u) return "";
    u = String(u).replace(/\\\//g, "/").trim();
    if (u.startsWith("//")) return "https:" + u;
    if (u.startsWith("/")) return HOST + u;
    return u;
}

function isVideoFormat(url) {
    return /\.(m3u8|mp4|flv|mkv)(\?|$)/i.test(String(url || ""));
}

function md5hex(s) {
    return CryptoJS.MD5(s).toString();
}

// artplayer AES-CBC 解密：key=md5(ts+'RY7e48naFXPsLJC')[16:32], iv=[0:16]
function decodeArtUrl(cipherText, timestamp) {
    if (!cipherText || !timestamp) return "";
    try {
        const md5 = md5hex(String(timestamp) + "RY7e48naFXPsLJC");
        const key = CryptoJS.enc.Utf8.parse(md5.slice(16, 32));
        const iv = CryptoJS.enc.Utf8.parse(md5.slice(0, 16));
        const raw = String(cipherText).replace(/\\\//g, "/");
        const dec = CryptoJS.AES.decrypt(raw, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
        return dec.toString(CryptoJS.enc.Utf8) || "";
    } catch (e) {
        return "";
    }
}

function decodePlayerUrl(data) {
    let url = (data && data.url) || "";
    const enc = String((data && data.encrypt) || "0");
    try {
        if (enc === "1") url = decodeURIComponent(url);
        else if (enc === "2") url = decodeURIComponent(CryptoJS.enc.Base64.parse(url).toString(CryptoJS.enc.Utf8));
        else if (enc === "3" && /^[0-9a-fA-F]+$/.test(url || "")) return url;
    } catch (e) {}
    return url.replace(/\\\//g, "/");
}

function parseList(txt) {
    const vods = [], seen = {};
    if (!txt) return vods;
    let blocks = txt.match(/<a\b(?=[^>]*class=["'][^"']*myui-vodlist__thumb[^"']*["'])(?=[^>]*href=["'][^"']*\/detail\/\d+\.html["'])[\s\S]*?<\/a>/gi) || [];
    if (!blocks.length) {
        blocks = txt.match(/<a\b[^>]+href=["'][^"']*\/detail\/\d+\.html["'][\s\S]*?<\/a>/gi) || [];
    }
    for (const b of blocks) {
        const hm = b.match(/href=["']([^"']*\/detail\/(\d+)\.html)["']/i);
        if (!hm) continue;
        const vid = fix(hm[1]);
        if (seen[vid]) continue;
        seen[vid] = 1;
        const tm = b.match(/title=["']([^"']+)["']/i) || b.match(/alt=["']([^"']+)["']/i) || b.match(/<h4[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
        const title = tm ? clean(tm[1]) : "";
        const pm = b.match(/(?:data-original|data-src)=["']([^"']+)["']/i) || b.match(/<img[^>]+src=["']((?!\/template\/|\/static\/)[^"']+)["']/i);
        const rm = b.match(/<span[^>]*class=["'][^"']*pic-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
        if (title) {
            vods.push({
                vod_id: vid,
                vod_name: title,
                vod_pic: pm ? fix(pm[1]) : "",
                vod_remarks: rm ? clean(rm[1]) : ""
            });
        }
    }
    return vods;
}

function makeFilters() {
    const years = [{ n: "全部", v: "" }];
    for (let y = 2026; y >= 2010; y--) years.push({ n: String(y), v: String(y) });
    const mk = (arr) => [{ n: "全部", v: "" }].concat(arr.map(x => ({ n: x, v: x })));
    const fs = [
        { key: "area", name: "地区", value: mk(["大陆", "香港", "台湾", "美国", "日本", "韩国", "英国", "法国", "德国", "泰国", "印度", "其它"]) },
        { key: "year", name: "年份", value: years },
        { key: "lang", name: "语言", value: mk(["国语", "英语", "粤语", "韩语", "日语", "泰语", "其它"]) },
        { key: "letter", name: "字母", value: mk("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").concat(["0-9"])) },
        { key: "by", name: "排序", value: [{ n: "时间", v: "time" }, { n: "人气", v: "hits" }, { n: "评分", v: "score" }] }
    ];
    const out = {};
    for (const c of ["1", "2", "3", "4", "5"]) out[c] = fs;
    return out;
}

function init(ext) {}

async function home(filter) {
    const classes = [
        { type_id: "1", type_name: "电影" },
        { type_id: "2", type_name: "电视剧" },
        { type_id: "3", type_name: "纪录片" },
        { type_id: "4", type_name: "动漫" },
        { type_id: "5", type_name: "综艺" }
    ];
    const result = { class: classes };
    if (filter) result.filters = makeFilters();
    return JSON.stringify(result);
}

async function homeVod() {
    const html = await getHtml(HOST + "/");
    return JSON.stringify({ list: parseList(html).slice(0, 30) });
}

function buildCategoryUrl(tid, pg, extend) {
    pg = String(pg || "1");
    const ext = extend || {};
    const area = String(ext.area || ""), by = String(ext.by || ""), lang = String(ext.lang || ""),
          letter = String(ext.letter || ""), year = String(ext.year || "");
    if (area || by || lang || letter || year) {
        const p = pg === "1" ? "" : pg;
        const fields = [String(tid), area, by, lang, "", "", "", "", p, "", "", year];
        return HOST + "/show/" + fields.join("-") + ".html";
    }
    if (pg === "1") return HOST + "/type/" + tid + ".html";
    return HOST + "/type/" + tid + "-" + pg + ".html";
}

async function category(tid, pg, filter, extend) {
    const url = buildCategoryUrl(tid, pg, extend);
    const txt = await getHtml(url, HOST + "/");
    const noResult = /没有找到您想要的结果|搜索无结果|暂无数据/.test(txt);
    const vods = noResult ? [] : parseList(txt);
    return JSON.stringify({
        list: vods,
        page: parseInt(pg) || 1,
        pagecount: vods.length ? 999999 : (parseInt(pg) || 1),
        limit: vods.length,
        total: vods.length ? 999999 : 0
    });
}

async function detail(ids) {
    const url = Array.isArray(ids) ? ids[0] : ids;
    const txt = await getHtml(url, HOST + "/");
    if (!txt) return JSON.stringify({ list: [] });

    let title = "";
    let mt = txt.match(/<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
             txt.match(/<title>([\s\S]*?)\s*-\s*嘀嗒影视/);
    if (mt) title = clean(mt[1]);

    let pic = "";
    const pb = txt.match(/<a[^>]*class=["'][^"']*myui-vodlist__thumb[^"']*picture[^"']*["'][\s\S]*?<\/a>/i);
    if (pb) {
        const pm = pb[0].match(/(?:data-original|data-src)=["']([^"']+)["']/i) ||
                   pb[0].match(/<img[^>]+src=["']((?!\/template\/|\/static\/)[^"']+)["']/i);
        if (pm) pic = fix(pm[1]);
    }

    const info = (name) => {
        const re = new RegExp(`<span[^>]*class=["'][^"']*text-muted[^"']*["'][^>]*>${name}[:：]</span>([\\s\\S]*?)(?:<span[^>]*class=["'][^"']*split-line|</p>)`, "i");
        const m = txt.match(re);
        return m ? clean(m[1]) : "";
    };

    let content = "";
    const cm = txt.match(/剧情简介[:：]<\/span>[\s\S]*?<span>([\s\S]*?)<\/span>/i) ||
               txt.match(/剧情简介[:：]<\/span>([\s\S]*?)<br/i);
    if (cm) content = clean(cm[1]);

    // 线路与剧集
    const playFrom = [], playUrl = [];
    const ta = txt.match(/<ul[^>]*class=["'][^"']*nav-tabs[^"']*active[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
    const names = [];
    if (ta) {
        const nm = ta[1].matchAll(/href=["']#playlist(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi);
        for (const x of nm) names.push(clean(x[2]));
    }
    const groupRe = /<div[^>]*id=["']playlist(\d+)["'][^>]*>([\s\S]*?)(?=<div[^>]*id=["']playlist\d+["']|<\/div>\s*<\/div>\s*<!--|<!-- 下载地址|$)/gi;
    let gi = 0, gm;
    while ((gm = groupRe.exec(txt)) !== null) {
        const g = gm[2];
        const eps = [], used = {};
        const em = g.matchAll(/<a\b[^>]+href=["']([^"']*\/play\/\d+-\d+-\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi);
        for (const e of em) {
            const fu = fix(e[1]);
            if (used[fu]) continue;
            used[fu] = 1;
            const name = clean(e[2]) || ("第" + (eps.length + 1) + "集");
            eps.push(name + "$" + fu);
        }
        if (eps.length) {
            let line = (gi < names.length && names[gi]) ? names[gi] : ("线路" + (gi + 1));
            gi++;
            if (/网盘|云盘|夸克|百度|UC|PikPak|阿里/i.test(line)) continue;
            playFrom.push(line);
            playUrl.push(eps.join("#"));
        }
    }
    if (!playUrl.length) {
        const eps = [], used = {};
        const em = txt.matchAll(/href=["']([^"']*\/play\/\d+-\d+-\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi);
        for (const e of em) {
            const fu = fix(e[1]);
            if (used[fu]) continue;
            used[fu] = 1;
            eps.push((clean(e[2]) || "播放") + "$" + fu);
        }
        if (eps.length) {
            playFrom.push("默认");
            playUrl.push(eps.join("#"));
        }
    }

    return JSON.stringify({
        list: [{
            vod_id: url,
            vod_name: title,
            vod_pic: pic,
            type_name: info("分类"),
            vod_year: info("年份").slice(0, 4),
            vod_area: info("地区"),
            vod_remarks: info("更新时间"),
            vod_actor: info("主演"),
            vod_director: info("导演"),
            vod_content: content,
            vod_play_from: playFrom.join("$$$"),
            vod_play_url: playUrl.join("$$$")
        }]
    });
}

// smartplay 加密解析
async function parseSmartPlay(txt, timestamp, referer) {
    try {
        if (txt.indexOf("isSmartPlay") < 0 || txt.slice(0, 8000).indexOf("true") < 0) return "";
        const vm = txt.match(/const\s+playPageUrl\s*=\s*["']([^"']+)/i);
        const cm = txt.match(/const\s+secretKeySeed\s*=\s*["']([^"']+)/i);
        if (!vm || !cm || !timestamp) return "";
        const t = Math.floor(Date.now() / 1000);
        const body = JSON.stringify({
            vkey: vm[1], code: cm[1], t: t,
            signature: md5hex(String(t))
        });
        const text = await postJson("https://hd.ticktockwow.com/smartplay-cache/api/webvideo_ty.php", body, HOST + "/static/player/artplayer/");
        const js = tryParse(text);
        const enc = (js && js.url) || "";
        let u = decodeArtUrl(enc, timestamp);
        u = u ? u.replace(/\\\//g, "/") : "";
        return isVideoFormat(u) ? u : "";
    } catch (e) {
        return "";
    }
}

async function parseArtPlayer(rawUrl, referer, nextUrl) {
    if (!rawUrl || /^https?:\/\/(?:pan\.quark|pan\.baidu|www\.aliyundrive|drive\.uc)/i.test(rawUrl)) return "";
    let art = HOST + "/static/player/artplayer/?url=" + encodeURIComponent(rawUrl);
    if (nextUrl) art += "&next=" + encodeURIComponent(nextUrl);
    const txt = await getHtml(art, referer);
    const ts = txt.match(/const\s+timestamp\s*=\s*["']([^"']+)/i);
    if (!ts) return "";
    const sm = await parseSmartPlay(txt, ts[1], referer);
    if (sm) return sm;
    const qm = txt.match(/const\s+qualities\s*=\s*(\[[\s\S]*?\]);/i);
    if (!qm) return "";
    try {
        const arr = JSON.parse(qm[1]);
        for (const it of arr) {
            let u = decodeArtUrl(it.url || "", ts[1]);
            if (u) {
                u = fix(u);
                if (isVideoFormat(u)) return u;
            }
        }
    } catch (e) {}
    return "";
}

async function play(flag, id, flags) {
    if (isVideoFormat(id)) {
        return JSON.stringify({ parse: 0, url: id, header: { "User-Agent": UA } });
    }
    const txt = await getHtml(id, HOST + "/");
    let data = null;
    const m = txt.match(/var\s+player_[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i);
    if (m) data = tryParse(m[1]);
    const url = decodePlayerUrl(data || {});
    if (isVideoFormat(url)) {
        const fu = fix(url);
        return JSON.stringify({ parse: 0, url: fu, header: { "User-Agent": UA } });
    }
    const final = await parseArtPlayer(url, id, (data && data.link_next) || "");
    if (final) {
        return JSON.stringify({ parse: 0, url: final, header: { "User-Agent": UA } });
    }
    const mm = txt.match(/(https?:\\?\/\\?\/[^"']+?\.(?:m3u8|mp4)[^"']*)/i);
    if (mm) {
        const u = fix(mm[1]);
        return JSON.stringify({ parse: 0, url: u, header: { "User-Agent": UA } });
    }
    if (url && /^https?:\/\//.test(url)) {
        return JSON.stringify({ parse: 1, url: url, header: HEADERS });
    }
    return JSON.stringify({ parse: 1, url: id, header: HEADERS });
}

async function search(wd, quick, pg) {
    const url = HOST + "/search/" + encodeURIComponent(wd) + "-------------.html";
    const txt = await getHtml(url, HOST + "/");
    const noResult = /没有找到您想要的结果|搜索无结果|暂无数据/.test(txt);
    const vods = noResult ? [] : parseList(txt);
    return JSON.stringify({ list: vods, page: parseInt(pg) || 1, pagecount: 1, limit: vods.length, total: vods.length });
}

export default { init, home, homeVod, category, detail, play, search };
