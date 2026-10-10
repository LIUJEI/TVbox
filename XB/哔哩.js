// 哔哩影视·B站 (api.bilibili.com) - QuickJS 版
// ext 可选: {"cookie":"SESSDATA=xx; bili_jct=xx; DedeUserID=xx","vmid":"uid"}
const API = "https://api.bilibili.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PLAY_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36";

let COOKIE = "";
let VMID = "";

function init(ext) {
    try {
        if (ext) {
            const e = typeof ext === "string" ? JSON.parse(ext) : ext;
            if (e && e.cookie) COOKIE = String(e.cookie).trim();
            if (e && e.vmid) VMID = String(e.vmid).trim();
        }
    } catch (e) {}
}

function baseHeaders() {
    const h = { "User-Agent": UA, "Referer": "https://www.bilibili.com/" };
    if (COOKIE) h["Cookie"] = COOKIE;
    return h;
}

async function getJson(url) {
    const r = await req(url, { headers: baseHeaders() });
    try { return JSON.parse((r && r.content) || "{}"); } catch (e) { return null; }
}

function zh(num) {
    const n = Number(num) || 0;
    if (n > 1e8) return (n / 1e8).toFixed(2) + "亿";
    if (n > 1e4) return (n / 1e4).toFixed(2) + "万";
    return String(num);
}

function mapList(j) {
    const videos = [];
    if (!j || j.code !== 0) return videos;
    const vodList = (j.result && j.result.list) ? j.result.list : ((j.data && j.data.list) ? j.data.list : []);
    for (const vod of vodList) {
        const sid = String(vod.season_id || "").trim();
        if (!sid) continue;
        videos.push({
            vod_id: sid,
            vod_name: String(vod.title || "").replace(/<[^>]+>/g, "").trim(),
            vod_pic: String(vod.cover || "").trim(),
            vod_remarks: (vod.new_ep ? vod.new_ep.index_show : vod.index_show) || ""
        });
    }
    return videos;
}

const CLASSES = [
    { type_id: "1", type_name: "番剧" },
    { type_id: "4", type_name: "国创" },
    { type_id: "2", type_name: "电影" },
    { type_id: "5", type_name: "电视剧" },
    { type_id: "3", type_name: "纪录片" },
    { type_id: "7", type_name: "综艺" },
    { type_id: "all", type_name: "全部" },
    { type_id: "timeline", type_name: "时间表" }
];

const ALL_FILTERS = [
    { key: "tid", name: "分类", value: [
        { n: "番剧", v: "1" }, { n: "国创", v: "4" }, { n: "电影", v: "2" },
        { n: "电视剧", v: "5" }, { n: "纪录片", v: "3" }, { n: "综艺", v: "7" }] },
    { key: "order", name: "排序", value: [
        { n: "播放数量", v: "2" }, { n: "更新时间", v: "0" }, { n: "最高评分", v: "4" },
        { n: "弹幕数量", v: "1" }, { n: "追看人数", v: "3" }, { n: "开播时间", v: "5" }, { n: "上映时间", v: "6" }] },
    { key: "season_status", name: "付费", value: [
        { n: "全部", v: "-1" }, { n: "免费", v: "1" }, { n: "付费", v: "2%2C6" }, { n: "大会员", v: "4%2C6" }] }
];

async function home(filter) {
    const result = { class: CLASSES };
    if (filter) result.filters = { "all": ALL_FILTERS, "timeline": ALL_FILTERS.slice(0, 1) };
    return JSON.stringify(result);
}

async function homeVod() {
    const videos = [];
    const j1 = await getJson(API + "/pgc/web/rank/list?season_type=1&pagesize=5&page=1&day=3");
    videos.push.apply(videos, mapList(j1).slice(0, 5));
    const others = await Promise.all([4, 2, 5, 3, 7].map(tid =>
        getJson(API + "/pgc/season/rank/web/list?season_type=" + tid + "&pagesize=5&page=1&day=3")));
    for (const j of others) videos.push.apply(videos, mapList(j).slice(0, 5));
    return JSON.stringify({ list: videos });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg) || 1;
    const ext = extend || {};
    let list = [];
    let pagecount = 20;
    let total = 0;

    if (tid === "all") {
        const ft = ext.tid || "1";
        const od = ext.order || "2";
        const st = ext.season_status || "-1";
        const j = await getJson(API + "/pgc/season/index/result?order=" + od + "&pagesize=20&type=1&season_type=" + ft + "&page=" + page + "&season_status=" + st);
        list = mapList(j);
        const hasNext = (j && j.data && j.data.has_next) ? 1 : 0;
        pagecount = hasNext ? page + 1 : page;
        total = list.length * pagecount;
    } else if (tid === "timeline") {
        const ft = ext.tid || "1";
        const j = await getJson(API + "/pgc/web/timeline/v2?season_type=" + ft + "&day_before=2&day_after=4");
        if (j && j.code === 0 && j.result) {
            (j.result.latest || []).forEach(function (vod) {
                list.push({
                    vod_id: String(vod.season_id),
                    vod_name: vod.title,
                    vod_pic: vod.cover,
                    vod_remarks: (vod.pub_index || "") + "　" + String(vod.follows || "").replace("系列", "")
                });
            });
            for (let i = 0; i < 7; i++) {
                const eps = (j.result.timeline && j.result.timeline[i] && j.result.timeline[i].episodes) || [];
                eps.forEach(function (vod) {
                    if (String(vod.published) === "0") {
                        list.push({
                            vod_id: String(vod.season_id),
                            vod_name: vod.title,
                            vod_pic: vod.cover,
                            vod_remarks: vod.pub_ts + "　" + (vod.pub_index || "")
                        });
                    }
                });
            }
        }
        pagecount = 1;
        total = list.length;
    } else if (tid === "1") {
        const j = await getJson(API + "/pgc/web/rank/list?season_type=1&pagesize=20&page=" + page + "&day=3");
        list = mapList(j);
        pagecount = list.length ? page + 1 : page;
        total = list.length * pagecount;
    } else {
        const j = await getJson(API + "/pgc/season/rank/web/list?season_type=" + tid + "&pagesize=20&page=" + page + "&day=3");
        list = mapList(j);
        pagecount = list.length ? page + 1 : page;
        total = list.length * pagecount;
    }
    return JSON.stringify({ list: list, page: page, pagecount: pagecount, limit: list.length, total: total });
}

async function detail(ids) {
    const sid = String(Array.isArray(ids) ? ids[0] : ids);
    if (!/^\d+$/.test(sid)) {
        return JSON.stringify({ list: [{ vod_id: sid, vod_name: "未知", vod_play_from: "", vod_play_url: "" }] });
    }
    const j = await getJson(API + "/pgc/view/web/season?season_id=" + sid);
    if (!j || j.code !== 0 || !j.result) {
        return JSON.stringify({ list: [{ vod_id: sid, vod_name: "加载失败", vod_play_from: "", vod_play_url: "" }] });
    }
    const r = j.result;
    const areas = (r.areas && r.areas[0] && r.areas[0].name) || "";
    const stat = r.stat || {};
    const status = "弹幕: " + zh(stat.danmakus) + "　点赞: " + zh(stat.likes) + "　投币: " + zh(stat.coins) + "　追番追剧: " + zh(stat.favorites);
    const score = r.rating ? ("评分: " + r.rating.score + "　" + (r.subtitle || "")) : ("暂无评分　" + (r.subtitle || ""));

    const eps1 = [], eps2 = [];
    (r.episodes || []).forEach(function (e) {
        const part = String(e.title || "").replace(/#/g, "-") + " " + (e.long_title || "");
        eps1.push(part + "$" + e.id + "_" + e.cid);
        eps2.push(part + "$" + (e.link || ""));
    });

    return JSON.stringify({
        list: [{
            vod_id: sid,
            vod_name: r.title || "",
            vod_pic: r.cover || "",
            type_name: r.share_sub_title || "",
            vod_year: (r.publish && r.publish.pub_time ? String(r.publish.pub_time).slice(0, 4) : "") || "",
            vod_area: areas,
            vod_remarks: (r.new_ep && r.new_ep.desc) || "",
            vod_actor: status,
            vod_director: score,
            vod_content: r.evaluate || "",
            vod_play_from: "B站$$$网页",
            vod_play_url: eps1.join("#") + "$$$" + eps2.join("#")
        }]
    });
}

// 内置解析回退链: playurl 解不了(大会员等)时依次尝试, 并发请求按优先级取第一个成功者
const JX_APIS = [
    "https://api.jxapi.cc/api/?key=e0df4139f1e7f09375e864cc4937570e&url=",
    "http://zxy-th1.jsszks.dpdns.org:8090/?url=",
    "https://test1.12321app.com/daoliansiquanjia.php?url="
];

function isPlayUrl(u) {
    return /^https?:\/\//.test(u || "") && /\.(m3u8|mp4|flv)(\?|$)/i.test(u || "");
}

async function jxFallback(pageUrl) {
    const enc = encodeURIComponent(pageUrl);
    const results = await Promise.all(JX_APIS.map(async function (api) {
        try {
            const r = await req(api + enc, { headers: { "User-Agent": UA } });
            const j = JSON.parse((r && r.content) || "{}");
            const u = j.url || (j.result && j.result.url) || "";
            if (isPlayUrl(u)) return String(u);
        } catch (e) {}
        return "";
    }));
    for (const u of results) { if (u) return u; }
    return "";
}

async function play(flag, id, flags) {
    // 网页线路: 交壳嗅探/解析
    if (/^http/.test(id)) {
        return JSON.stringify({ parse: 1, url: id, header: { "User-Agent": UA } });
    }
    // B站线路: eid_cid
    const ids = String(id).split("_");
    const danmaku = API + "/x/v1/dm/list.so?oid=" + ids[1];
    const j = await getJson(API + "/pgc/player/web/playurl?qn=116&ep_id=" + ids[0] + "&cid=" + ids[1]);
    if (j && j.message === "success" && j.result && j.result.durl && j.result.durl.length) {
        const durl = j.result.durl;
        let maxSize = -1, pos = -1;
        durl.forEach(function (d, i) {
            if (maxSize < Number(d.size)) { maxSize = Number(d.size); pos = i; }
        });
        if (pos < 0) pos = 0;
        return JSON.stringify({
            parse: 0,
            url: durl[pos].url,
            header: { "User-Agent": PLAY_UA, "Referer": "https://www.bilibili.com/" },
            danmaku: danmaku
        });
    }
    // B站解不了 → 内置解析链 → 仍不行交壳嗅探
    const page = "https://www.bilibili.com/bangumi/play/ep" + ids[0];
    const parsed = await jxFallback(page);
    if (parsed) {
        return JSON.stringify({ parse: 0, url: parsed, header: { "User-Agent": PLAY_UA } });
    }
    return JSON.stringify({ parse: 1, url: page, header: { "User-Agent": UA } });
}

async function search(wd, quick, pg) {
    if (!COOKIE) {
        return JSON.stringify({ list: [{ vod_id: "no_data", vod_name: String(wd) + "➢搜索需要Cookie", vod_remarks: "在ext里填cookie后可搜索", vod_pic: "" }], page: 1 });
    }
    const kw = encodeURIComponent(wd);
    const u1 = API + "/x/web-interface/search/type?keyword=" + kw + "&page=" + (parseInt(pg) || 1) + "&search_type=media_bangumi";
    const u2 = API + "/x/web-interface/search/type?keyword=" + kw + "&page=" + (parseInt(pg) || 1) + "&search_type=media_ft";
    const j1 = await getJson(u1);
    const j2 = await getJson(u2);
    const list = [];
    const collect = (j) => {
        if (j && j.code === 0 && j.data && j.data.result) {
            for (const vod of j.data.result) {
                const sid = String(vod.season_id || "").trim();
                if (!sid) continue;
                list.push({
                    vod_id: sid,
                    vod_name: String(vod.title || "").replace(/<[^>]+>/g, "").trim(),
                    vod_pic: String(vod.cover || "").trim(),
                    vod_remarks: vod.index_show || ""
                });
            }
        }
    };
    collect(j1);
    collect(j2);
    if (!list.length && j1 && j1.code !== 0) {
        return JSON.stringify({ list: [{ vod_id: "no_data", vod_name: String(wd) + "➢" + (j1.message || "搜索失败"), vod_remarks: "cookie可能已失效", vod_pic: "" }], page: 1 });
    }
    return JSON.stringify({ list: list, page: parseInt(pg) || 1 });
}

export default { init, home, homeVod, category, detail, play, search };
