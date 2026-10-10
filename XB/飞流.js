// 飞流视频 (flixflop.com) - QuickJS 版 (原 飞流视频.py)
const HOST = "https://www.flixflop.com";
const API = HOST + "/api/v1";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "user-agent": UA
};

function init(ext) {}

async function getJson(path) {
    try {
        const r = await req(API + path, { headers: HEADERS });
        const t = (r && r.content) || "";
        return JSON.parse(t);
    } catch (e) { return {}; }
}

function vodItem(item) {
    return {
        vod_id: item.video_id || "",
        vod_name: item.title || "",
        vod_pic: item.cover_image || "",
        vod_remarks: item.remarks || "",
        vod_year: String(item.published_year || "")
    };
}

async function home(filter) {
    const result = { class: [], filters: {}, list: [] };
    const catsData = await getJson("/categories");
    const cats = catsData.data || [];
    for (const c of cats) {
        result.class.push({ type_id: c.category_id, type_name: c.name });
    }
    // 各分类筛选条件
    for (const c of cats) {
        const catId = c.category_id;
        const fdata = (await getJson("/explore/" + catId + "/filters")).data || {};
        const fl = [];
        const areas = fdata.areas || [];
        if (areas.length) {
            const v = [{ n: "全部", v: "" }];
            for (const a of areas) v.push({ n: a.name, v: a.area_id });
            fl.push({ key: "area", name: "地区", value: v });
        }
        const genres = fdata.genres || [];
        if (genres.length > 1) {
            const v = [{ n: "全部", v: "" }];
            for (const g of genres) v.push({ n: g.name, v: g.genre_id });
            fl.push({ key: "genre", name: "类型", value: v });
        }
        const years = fdata.published_years || [];
        const vy = [{ n: "全部", v: "" }];
        for (const y of years) {
            if (typeof y === "number" && y >= 2000 && y <= 2035) vy.push({ n: String(y), v: String(y) });
        }
        if (vy.length > 1) fl.push({ key: "year", name: "年份", value: vy });
        const langs = fdata.languages || [];
        if (langs.length) {
            const v = [{ n: "全部", v: "" }];
            for (const l of langs) v.push({ n: l.name, v: l.language_id });
            fl.push({ key: "language", name: "语言", value: v });
        }
        result.filters[catId] = fl;
    }
    // 首页推荐: 每日推荐, 空则取首个分类周推荐
    const daily = (await getJson("/landing/recommendations/daily")).data || [];
    for (const item of daily) result.list.push(vodItem(item));
    if (!result.list.length && cats.length) {
        const weekly = (await getJson("/landing/" + cats[0].category_id + "/recommendations/weekly")).data || {};
        for (const item of (weekly.latest || [])) result.list.push(vodItem(item));
    }
    return JSON.stringify(result);
}

async function homeVod() {
    return JSON.stringify({ list: [] });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const e = extend || {};
    let qs = "page=" + page;
    const keys = ["area", "genre", "year", "language"];
    for (const k of keys) {
        if (e[k]) qs += "&" + k + "=" + encodeURIComponent(String(e[k]));
    }
    const data = await getJson("/explore/" + tid + "?" + qs);
    const meta = data.meta || {};
    const total = parseInt(meta.count, 10) || 0;
    const videos = [];
    for (const item of (data.data || [])) videos.push(vodItem(item));
    return JSON.stringify({
        list: videos,
        page: page,
        limit: 12,
        total: total,
        pagecount: total > 0 ? Math.ceil(total / 12) : page
    });
}

async function detail(ids) {
    const videoId = Array.isArray(ids) ? ids[0] : ids;
    const meta = await getJson("/videos/" + videoId + "/metadata");
    const data = meta.data || {};
    const actors = data.actors || [];
    const an = [];
    for (const a of actors) an.push(a.name || "");
    const directors = data.directors || [];
    const dn = [];
    for (const d of directors) dn.push(d.name || "");
    const vod = {
        vod_id: videoId,
        vod_name: data.title || "",
        vod_pic: data.cover_image || "",
        type_name: data.genre || data.category || "",
        vod_year: String(data.published_year || ""),
        vod_area: data.area || "",
        vod_remarks: data.remarks || "",
        vod_actor: an.join(", "),
        vod_director: dn.join(", "),
        vod_content: data.description || "",
        vod_play_from: "",
        vod_play_url: ""
    };
    const srcData = await getJson("/videos/" + videoId + "/sources");
    const froms = [], urls = [];
    for (const s of (srcData.data || [])) {
        const name = s.name || "", url = s.url || "";
        if (name && url) { froms.push(name); urls.push(url); }
    }
    vod.vod_play_from = froms.join("$$$");
    vod.vod_play_url = urls.join("$$$");
    return JSON.stringify({ list: [vod] });
}

async function play(flag, id, vipFlags) {
    // id 已是 m3u8 直链, 无需解析
    return JSON.stringify({
        parse: 0,
        url: String(id),
        header: { "referer": HOST, "user-agent": UA }
    });
}

async function search(key, quick, pg) {
    const data = await getJson("/explore/search?query=" + encodeURIComponent(String(key)));
    const videos = [];
    for (const item of (data.data || [])) {
        videos.push({
            vod_id: item.video_id || "",
            vod_name: item.title || "",
            vod_pic: item.cover_image || "",
            vod_remarks: item.remarks || ""
        });
    }
    return JSON.stringify({ list: videos });
}

export default { init, home, homeVod, category, detail, play, search };