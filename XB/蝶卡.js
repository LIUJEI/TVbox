// 蝶卡影视 (diekawang.com) - QuickJS 版
const HOST = "https://www.diekawang.com";
const UA = "Mozilla/5.0 (Linux; Android 14; 22127RK46C) AppleWebKit/537.36";

const HEADERS = { "User-Agent": UA, "Referer": HOST + "/" };

async function getHtml(url) {
    if (!url.startsWith("http")) url = HOST + (url.startsWith("/") ? url : "/" + url);
    const r = await req(url, { headers: HEADERS });
    return (r && r.content) || "";
}

function cleanText(s) {
    if (!s) return "";
    return String(s).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function absUrl(u) {
    if (!u) return "";
    u = String(u).replace(/\\\//g, "/").trim();
    if (u.startsWith("//")) return "https:" + u;
    if (u.startsWith("http")) return u;
    if (u.startsWith("/")) return HOST + u;
    return HOST + "/" + u;
}

// file: 去3字符前缀 -> base64解码 -> URL反编码
function decodeFile(fileStr) {
    if (!fileStr || fileStr.length <= 3) return "";
    try {
        const raw = fileStr.slice(3);
        const decoded = CryptoJS.enc.Base64.parse(raw).toString(CryptoJS.enc.Utf8);
        return decodeURIComponent(decoded);
    } catch (e) {
        return "";
    }
}

function playHeader() {
    return { "User-Agent": UA };
}

function parseListCards(html) {
    const result = [], seen = {};
    // 主选择器: moon-list-item 卡片
    let cards = html.match(/<div[^>]*class="[^"]*moon-list-item[^"]*"[^>]*>\s*<a[^>]*href="\/vod\/player\/0\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g) || [];
    let re1 = /<div[^>]*class="[^"]*moon-list-item[^"]*"[^>]*>\s*<a[^>]*href="\/vod\/player\/0\/(\d+)"[^>]*>([\s\S]*?)<\/a>/;
    for (const c of cards) {
        const m = c.match(re1);
        if (!m) continue;
        const vid = m[1], block = m[2];
        if (seen[vid]) continue;
        let nm = block.match(/class="[^"]*name[^"]*item-title[^"]*"[^>]*>([\s\S]*?)<\/p>/) ||
                 block.match(/class="[^"]*item-title[^"]*"[^>]*>([\s\S]*?)<\/p>/);
        const name = nm ? cleanText(nm[1]) : "";
        if (!name) continue;
        let pm = block.match(/data-original="([^"]+)"/) || block.match(/data-src="([^"]+)"/) || block.match(/src="([^"]+)"/);
        const pic = pm ? absUrl(pm[1]) : "";
        let rm = block.match(/class="[^"]*rate[^"]*"[^>]*>([\s\S]*?)<\/label>/);
        const remark = rm ? cleanText(rm[1]) : "";
        result.push({ vod_id: vid + "|$|" + name + "|$|" + pic + "|$|" + remark, vod_name: name, vod_pic: pic, vod_remarks: remark });
        seen[vid] = 1;
    }
    // 兜底
    if (!result.length) {
        const re2 = /<a[^>]*href="\/vod\/player\/0\/(\d+)"[^>]*class="[^"]*(?:item|goLinklist)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re2.exec(html)) !== null) {
            const vid = m[1], block = m[2];
            if (seen[vid]) continue;
            const nm = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            const name = nm ? cleanText(nm[1]) : "";
            if (!name) continue;
            let pm = block.match(/data-original="([^"]+)"/) || block.match(/src="([^"]+)"/);
            const pic = pm ? absUrl(pm[1]) : "";
            let rm = block.match(/class="[^"]*rate[^"]*"[^>]*>([\s\S]*?)<\/label>/);
            const remark = rm ? cleanText(rm[1]) : "";
            result.push({ vod_id: vid + "|$|" + name + "|$|" + pic + "|$|" + remark, vod_name: name, vod_pic: pic, vod_remarks: remark });
            seen[vid] = 1;
        }
    }
    return result;
}

function parseSearchCards(html) {
    const result = [], seen = {};
    const re = /<a[^>]*href="\/vod\/player\/0\/(\d+)"[^>]*class="[^"]*seachlist[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const vid = m[1], block = m[2];
        if (seen[vid]) continue;
        const nm = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
        const name = nm ? cleanText(nm[1]) : "";
        if (!name) continue;
        let pm = block.match(/data-src="([^"]+)"/) || block.match(/src="([^"]+)"/);
        const pic = pm ? absUrl(pm[1]) : "";
        const spans = block.match(/<span[^>]*>([\s\S]*?)<\/span>/g) || [];
        const parts = spans.map(s => cleanText(s)).filter(s => s);
        const remark = parts.slice(0, 3).join(" ");
        result.push({ vod_id: vid + "|$|" + name + "|$|" + pic + "|$|" + remark, vod_name: name, vod_pic: pic, vod_remarks: remark });
        seen[vid] = 1;
    }
    return result;
}

function getPageCount(html) {
    const m = html.match(/href="\/vod\/list\/(\d+)\/\d+\/\d+"[^>]*>[^<]*尾页/);
    if (m) return parseInt(m[1]) || 99;
    return 99;
}

function isNoResult(html) {
    return /没有找到您想要的结果|没有找到.*结果|搜索无结果|暂无影片|没有搜到|无搜索结果/.test(html);
}

const FILTERS = {
    "1": [{ key: "cate", name: "类型", value: [
        { n: "全部", v: "0" }, { n: "动作片", v: "9" }, { n: "喜剧片", v: "10" }, { n: "爱情片", v: "11" },
        { n: "恐怖片", v: "12" }, { n: "剧情片", v: "13" }, { n: "科幻片", v: "14" }, { n: "惊悚片", v: "15" },
        { n: "奇幻片", v: "16" }, { n: "动画片", v: "17" }, { n: "悬疑片", v: "18" }, { n: "冒险片", v: "19" },
        { n: "纪录片", v: "20" }, { n: "战争片", v: "21" }, { n: "倫理片", v: "460" }] }],
    "2": [{ key: "cate", name: "类型", value: [
        { n: "全部", v: "0" }, { n: "国产剧", v: "22" }, { n: "香港剧", v: "23" }, { n: "台湾剧", v: "24" },
        { n: "欧美剧", v: "25" }, { n: "日本剧", v: "26" }, { n: "韩国剧", v: "27" }, { n: "泰国剧", v: "28" },
        { n: "海外剧", v: "29" }] }],
    "3": [{ key: "cate", name: "类型", value: [
        { n: "全部", v: "0" }, { n: "大陆综艺", v: "30" }, { n: "港台综艺", v: "31" }, { n: "日韩综艺", v: "32" },
        { n: "欧美综艺", v: "33" }, { n: "海外综艺", v: "34" }] }],
    "4": [{ key: "cate", name: "类型", value: [
        { n: "全部", v: "0" }, { n: "国产动漫", v: "35" }, { n: "日韩动漫", v: "36" }, { n: "欧美动漫", v: "37" },
        { n: "海外动漫", v: "38" }, { n: "港台动漫", v: "459" }] }],
    "457": [{ key: "cate", name: "类型", value: [
        { n: "全部", v: "0" }, { n: "漫剧", v: "540" }, { n: "玄幻", v: "541" }, { n: "剧情", v: "542" },
        { n: "女性成长", v: "543" }, { n: "权谋", v: "544" }, { n: "豪门", v: "545" }, { n: "齐幻", v: "546" },
        { n: "宫斗", v: "547" }, { n: "脑洞", v: "548" }, { n: "科幻", v: "549" }, { n: "冒险", v: "550" },
        { n: "仙侠", v: "551" }, { n: "喜剧", v: "552" }, { n: "动作", v: "553" }, { n: "悬疑", v: "554" },
        { n: "战神", v: "555" }, { n: "刑侦", v: "556" }, { n: "求生", v: "557" }, { n: "商战", v: "558" },
        { n: "恐怖", v: "559" }, { n: "武侠", v: "560" }, { n: "爱情", v: "561" }, { n: "AI漫剧", v: "562" }] }],
    "462": [{ key: "cate", name: "类型", value: [{ n: "全部", v: "0" }] }]
};

function init(ext) {}

async function home(filter) {
    const classes = [
        { type_id: "1", type_name: "电影" },
        { type_id: "2", type_name: "电视剧" },
        { type_id: "3", type_name: "综艺" },
        { type_id: "4", type_name: "动漫" },
        { type_id: "457", type_name: "短剧" },
        { type_id: "462", type_name: "体育" }
    ];
    const result = { class: classes };
    if (filter) result.filters = FILTERS;
    return JSON.stringify(result);
}

async function homeVod() {
    const html = await getHtml(HOST + "/vod/list/1/1/0");
    return JSON.stringify({ list: parseListCards(html) });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg) || 1;
    const subType = (extend && extend.cate) || "0";
    const url = `${HOST}/vod/list/${page}/${tid}/${subType}`;
    const html = await getHtml(url);
    const items = parseListCards(html);
    if (!items.length && isNoResult(html)) {
        return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 10, total: 0 });
    }
    const pagecount = getPageCount(html);
    return JSON.stringify({ list: items, page: page, pagecount: pagecount, limit: 10, total: pagecount * 10 });
}

async function detail(ids) {
    const raw = String(Array.isArray(ids) ? ids[0] : ids);
    const ps = raw.split("|$|");
    const vid = ps[0];
    const oldName = ps[1] || "", oldPic = ps[2] || "", oldRemark = ps[3] || "";

    const url = `${HOST}/vod/player/0/${vid}`;
    let html = "";
    try {
        html = await getHtml(url);
    } catch (e) {
        return JSON.stringify({ list: [{
            vod_id: raw, vod_name: oldName || "视频", vod_pic: oldPic, vod_remarks: oldRemark,
            vod_play_from: "播放", vod_play_url: "播放$" + vid
        }]});
    }

    let vodName = oldName, vodPic = oldPic, vodYear = "", vodArea = "", vodActor = "", vodDirector = "", vodScore = "";

    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (h1) vodName = cleanText(h1[1]) || vodName;

    let im = html.match(/imgUrl:\s*["']([^"']+)/);
    if (im) vodPic = absUrl(im[1].replace(/\\\//g, "/"));
    else if (!vodPic) {
        im = html.match(/data-original="([^"]+)"/);
        if (im) vodPic = absUrl(im[1]);
    }

    const sm = html.match(/class="[^"]*din-condensed[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    if (sm) vodScore = cleanText(sm[1]);

    const ls = html.match(/class="label-list"[^>]*>([\s\S]*?)<\/div>/);
    if (ls) {
        const spans = ls[1].match(/<span[^>]*>([\s\S]*?)<\/span>/g) || [];
        const texts = spans.map(s => cleanText(s)).filter(s => s);
        for (const t of texts) {
            if (/^\d{4}$/.test(t)) vodYear = t;
            else if (t !== vodScore && !vodArea) vodArea = t;
        }
    }

    const dm = html.match(/class="worker-name"[^>]*>\s*导演\s*<\/a>\s*<div[^>]*>([\s\S]*?)<\/div>/);
    if (dm) vodDirector = cleanText(dm[1]);
    const am = html.match(/class="worker-name"[^>]*>\s*演员\s*<\/a>\s*<div[^>]*>([\s\S]*?)<\/div>/);
    if (am) vodActor = cleanText(am[1]);
    if (!vodActor) {
        const kw = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/);
        if (kw) {
            const parts = kw[1].split(",");
            if (parts.length >= 6) vodActor = parts[5];
        }
    }

    // temLineList 播放树
    const playFrom = [], playUrl = [];
    const tm = html.match(/temLineList\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (tm) {
        try {
            const lineData = JSON.parse(tm[1]);
            const lines = {}, order = [];
            for (const ep of lineData) {
                const tag = ep.tag || "播放";
                if (!lines[tag]) { lines[tag] = []; order.push(tag); }
                const epName = ep.name || ep.subTitle || "播放";
                lines[tag].push(epName + "$" + (ep.file || ""));
            }
            for (const tag of order) {
                playFrom.push(tag);
                playUrl.push(lines[tag].join("#"));
            }
        } catch (e) {}
    }
    if (!playFrom.length) {
        playFrom.push("播放");
        playUrl.push("播放$" + vid);
    }

    return JSON.stringify({
        list: [{
            vod_id: raw,
            vod_name: vodName || "视频",
            vod_pic: vodPic,
            vod_year: vodYear,
            vod_area: vodArea,
            vod_actor: vodActor,
            vod_director: vodDirector,
            vod_score: vodScore,
            vod_remarks: oldRemark || vodScore,
            vod_content: oldRemark,
            vod_play_from: playFrom.join("$$$"),
            vod_play_url: playUrl.join("$$$")
        }]
    });
}

async function play(flag, id, flags) {
    // 直链
    if (/\.(m3u8|mp4)(\?|$)/i.test(id) || id.startsWith("http")) {
        return JSON.stringify({ parse: 0, url: id, header: playHeader() });
    }
    // 纯数字ID兜底嗅探
    if (/^\d+$/.test(id)) {
        return JSON.stringify({ parse: 1, url: `${HOST}/vod/player/0/${id}`, header: HEADERS });
    }
    // 解码 file
    const decoded = decodeFile(id);
    if (decoded && decoded.startsWith("http")) {
        return JSON.stringify({ parse: 0, url: decoded, header: playHeader() });
    }
    return JSON.stringify({ parse: 1, url: id, header: HEADERS });
}

async function search(wd, quick, pg) {
    if (!wd) return JSON.stringify({ list: [], page: 1 });
    const url = `${HOST}/public/auto/search1.html?keyword=${encodeURIComponent(wd)}`;
    const html = await getHtml(url);
    const items = parseSearchCards(html);
    return JSON.stringify({ list: items, page: 1 });
}

export default { init, home, homeVod, category, detail, play, search };