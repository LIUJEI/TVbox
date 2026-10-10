// 爱奇艺 (pcw-api.iqiyi.com 官方API) - QuickJS 版
const SITE = "https://m.iqiyi.com";
const API = "https://pcw-api.iqiyi.com";
const SAPI = "https://search.video.iqiyi.com";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const HEADERS = {
    "User-Agent": UA,
    "Referer": SITE,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9"
};

const CHANNELS = {
    "1": { name: "电影", channel_id: "1" },
    "2": { name: "电视剧", channel_id: "2" },
    "3": { name: "动漫", channel_id: "3" },
    "4": { name: "综艺", channel_id: "4" },
    "6": { name: "纪录片", channel_id: "6" },
    "7": { name: "短片", channel_id: "7" },
    "8": { name: "少儿", channel_id: "8" }
};

function yearList(end) {
    const v = [{ n: "全部年份", v: "0" }];
    for (let y = 2026; y >= end; y--) v.push({ n: String(y), v: String(y) });
    return v;
}

const FILTERS = {
    "1": [
        { key: "mode", name: "排序", value: [{ n: "综合排序", v: "24" }, { n: "热播榜", v: "11" }, { n: "新上线", v: "8" }] },
        { key: "area", name: "地区", value: [{ n: "全部地区", v: "0" }, { n: "内地", v: "1" }, { n: "香港", v: "2" }, { n: "台湾", v: "3" }, { n: "美国", v: "4" }, { n: "韩国", v: "5" }, { n: "日本", v: "6" }, { n: "泰国", v: "7" }, { n: "英国", v: "8" }, { n: "其它", v: "9" }] },
        { key: "type", name: "类型", value: [{ n: "全部类型", v: "0" }, { n: "动作", v: "1" }, { n: "喜剧", v: "2" }, { n: "爱情", v: "3" }, { n: "科幻", v: "4" }, { n: "恐怖", v: "5" }, { n: "剧情", v: "6" }, { n: "战争", v: "7" }, { n: "悬疑", v: "8" }, { n: "动画", v: "9" }, { n: "奇幻", v: "10" }, { n: "冒险", v: "11" }, { n: "犯罪", v: "12" }, { n: "惊悚", v: "13" }] },
        { key: "year", name: "年份", value: [{ n: "全部年份", v: "0" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "2016" }, { n: "2015", v: "2015" }, { n: "2011-2014", v: "2011_2014" }, { n: "2000-2010", v: "2000_2010" }, { n: "90年代", v: "1990_1999" }, { n: "80年代", v: "1980_1989" }, { n: "更早", v: "-1980" }] },
        { key: "pay", name: "资费", value: [{ n: "全部资费", v: "0" }, { n: "免费", v: "1" }, { n: "付费", v: "2" }] }
    ],
    "2": [
        { key: "mode", name: "排序", value: [{ n: "综合排序", v: "24" }, { n: "热播榜", v: "11" }, { n: "新上线", v: "8" }] },
        { key: "area", name: "地区", value: [{ n: "全部地区", v: "0" }, { n: "内地", v: "1" }, { n: "港剧", v: "2" }, { n: "韩剧", v: "5" }, { n: "美剧", v: "4" }, { n: "日剧", v: "6" }, { n: "泰剧", v: "7" }, { n: "台湾地区", v: "3" }, { n: "英剧", v: "8" }, { n: "其它", v: "9" }] },
        { key: "type", name: "类型", value: [{ n: "全部类型", v: "0" }, { n: "自制", v: "1" }, { n: "古装", v: "2" }, { n: "言情", v: "3" }, { n: "武侠", v: "4" }, { n: "偶像", v: "5" }, { n: "家庭", v: "6" }, { n: "青春", v: "7" }, { n: "都市", v: "8" }, { n: "喜剧", v: "9" }, { n: "战争", v: "10" }, { n: "军旅", v: "11" }, { n: "谍战", v: "12" }, { n: "悬疑", v: "13" }, { n: "罪案", v: "14" }, { n: "穿越", v: "15" }, { n: "宫廷", v: "16" }, { n: "历史", v: "17" }, { n: "神话", v: "18" }, { n: "科幻", v: "19" }, { n: "年代", v: "20" }, { n: "农村", v: "21" }, { n: "商战", v: "22" }, { n: "剧情", v: "23" }, { n: "奇幻", v: "24" }, { n: "网剧", v: "25" }, { n: "竖短片", v: "26" }] },
        { key: "year", name: "年份", value: yearList(2016).concat([{ n: "2011-2014", v: "2011_2014" }, { n: "2000-2010", v: "2000_2010" }, { n: "90年代", v: "1990_1999" }, { n: "80年代", v: "1980_1989" }, { n: "更早", v: "-1980" }]) },
        { key: "pay", name: "资费", value: [{ n: "全部资费", v: "0" }, { n: "免费", v: "1" }, { n: "付费", v: "2" }] }
    ],
    "3": [
        { key: "mode", name: "排序", value: [{ n: "综合排序", v: "24" }, { n: "热播榜", v: "11" }, { n: "新上线", v: "8" }] },
        { key: "area", name: "地区", value: [{ n: "全部地区", v: "0" }, { n: "国产", v: "1" }, { n: "日本", v: "6" }, { n: "欧美", v: "4" }, { n: "韩国", v: "5" }, { n: "其它", v: "9" }] },
        { key: "type", name: "类型", value: [{ n: "全部类型", v: "0" }, { n: "热血", v: "1" }, { n: "恋爱", v: "2" }, { n: "科幻", v: "3" }, { n: "奇幻", v: "4" }, { n: "冒险", v: "5" }, { n: "搞笑", v: "6" }, { n: "战斗", v: "7" }, { n: "神魔", v: "8" }, { n: "竞技", v: "9" }, { n: "日常", v: "10" }, { n: "校园", v: "11" }, { n: "治愈", v: "12" }, { n: "悬疑", v: "13" }] },
        { key: "year", name: "年份", value: [{ n: "全部年份", v: "0" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "更早", v: "-2017" }] },
        { key: "pay", name: "资费", value: [{ n: "全部资费", v: "0" }, { n: "免费", v: "1" }, { n: "付费", v: "2" }] }
    ],
    "4": [
        { key: "mode", name: "排序", value: [{ n: "综合排序", v: "24" }, { n: "热播榜", v: "11" }, { n: "新上线", v: "8" }] },
        { key: "area", name: "地区", value: [{ n: "全部地区", v: "0" }, { n: "内地", v: "1" }, { n: "港台", v: "2" }, { n: "日韩", v: "5" }, { n: "欧美", v: "4" }, { n: "其它", v: "9" }] },
        { key: "type", name: "类型", value: [{ n: "全部类型", v: "0" }, { n: "真人秀", v: "1" }, { n: "脱口秀", v: "2" }, { n: "选秀", v: "3" }, { n: "访谈", v: "4" }, { n: "情感", v: "5" }, { n: "生活", v: "6" }, { n: "美食", v: "7" }, { n: "旅游", v: "8" }, { n: "游戏", v: "9" }, { n: "音乐", v: "10" }, { n: "时尚", v: "11" }, { n: "文化", v: "12" }, { n: "搞笑", v: "13" }] },
        { key: "year", name: "年份", value: [{ n: "全部年份", v: "0" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "2019" }, { n: "更早", v: "-2019" }] },
        { key: "pay", name: "资费", value: [{ n: "全部资费", v: "0" }, { n: "免费", v: "1" }, { n: "付费", v: "2" }] }
    ],
    "6": [
        { key: "mode", name: "排序", value: [{ n: "综合排序", v: "24" }, { n: "热播榜", v: "11" }, { n: "新上线", v: "8" }] },
        { key: "area", name: "地区", value: [{ n: "全部地区", v: "0" }, { n: "内地", v: "1" }, { n: "国外", v: "9" }] },
        { key: "type", name: "类型", value: [{ n: "全部类型", v: "0" }, { n: "自然", v: "1" }, { n: "历史", v: "2" }, { n: "人文", v: "3" }, { n: "社会", v: "4" }, { n: "科技", v: "5" }, { n: "探险", v: "6" }, { n: "军事", v: "7" }, { n: "传记", v: "8" }] },
        { key: "year", name: "年份", value: [{ n: "全部年份", v: "0" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "更早", v: "-2020" }] },
        { key: "pay", name: "资费", value: [{ n: "全部资费", v: "0" }, { n: "免费", v: "1" }, { n: "付费", v: "2" }] }
    ],
    "7": [
        { key: "mode", name: "排序", value: [{ n: "综合排序", v: "24" }, { n: "热播榜", v: "11" }, { n: "新上线", v: "8" }] },
        { key: "year", name: "年份", value: [{ n: "全部年份", v: "0" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }] },
        { key: "pay", name: "资费", value: [{ n: "全部资费", v: "0" }, { n: "免费", v: "1" }, { n: "付费", v: "2" }] }
    ],
    "8": [
        { key: "mode", name: "排序", value: [{ n: "综合排序", v: "24" }, { n: "热播榜", v: "11" }, { n: "新上线", v: "8" }] },
        { key: "type", name: "类型", value: [{ n: "全部类型", v: "0" }, { n: "动画", v: "1" }, { n: "儿歌", v: "2" }, { n: "早教", v: "3" }, { n: "益智", v: "4" }, { n: "故事", v: "5" }, { n: "科普", v: "6" }] },
        { key: "year", name: "年份", value: [{ n: "全部年份", v: "0" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "更早", v: "-2021" }] },
        { key: "pay", name: "资费", value: [{ n: "全部资费", v: "0" }, { n: "免费", v: "1" }, { n: "付费", v: "2" }] }
    ]
};

function init(ext) {}

function qs(params) {
    const q = [];
    for (const k in params) {
        if (params[k] === undefined || params[k] === null) continue;
        q.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
    }
    return q.join("&");
}

async function getJson(url) {
    const r = await req(url, { headers: HEADERS });
    try { return JSON.parse((r && r.content) || "{}"); } catch (e) { return null; }
}

function parseItem(item) {
    return {
        vod_id: String(item.albumId || ""),
        vod_name: item.name || "",
        vod_pic: item.imageUrl || "",
        vod_remarks: item.focus || (item.latestOrder ? "更新至" + item.latestOrder + "集" : ""),
        vod_year: item.period ? String(item.period).slice(0, 4) : "",
        vod_area: (item.categories || []).join(",")
    };
}

async function home(filter) {
    const classes = [];
    for (const k in CHANNELS) classes.push({ type_id: k, type_name: CHANNELS[k].name });
    return JSON.stringify({ class: classes, filters: FILTERS });
}

async function homeVod() {
    const videos = [];
    for (const cid of ["2", "1", "3", "4"]) {
        const url = API + "/search/recommend/list?" + qs({
            channel_id: cid, data_type: "1", mode: "11",
            page_id: "1", ret_num: "12", session: ""
        });
        const data = await getJson(url);
        if (data && data.code === "A00000" && data.data && data.data.list) {
            for (const item of data.data.list.slice(0, 6)) videos.push(parseItem(item));
        }
        if (videos.length >= 24) break;
    }
    return JSON.stringify({ list: videos });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg) || 1;
    const ext = extend || {};
    const url = API + "/search/recommend/list?" + qs({
        channel_id: (CHANNELS[tid] || {}).channel_id || "2",
        data_type: "1",
        mode: ext.mode || "24",
        page_id: page,
        ret_num: "48",
        session: ""
    });
    const data = await getJson(url);
    const videos = [];
    let pagecount = page;
    if (data && data.code === "A00000" && data.data && data.data.list) {
        for (const item of data.data.list) videos.push(parseItem(item));
        pagecount = data.data.has_next ? page + 1 : page;
    }
    return JSON.stringify({ list: videos, page: page, pagecount: pagecount, limit: 48, total: videos.length * page });
}

async function detail(ids) {
    const videoId = String(Array.isArray(ids) ? ids[0] : ids);
    const albumId = videoId.indexOf("_") >= 0 ? videoId.split("_")[0] : videoId;
    const list = [];
    // 剧集列表
    const url = API + "/albums/album/avlistinfo?" + qs({ aid: albumId, page: "1", size: "30" });
    const data = await getJson(url);
    let episodes = [];
    if (data && data.code === "A00000" && data.data && data.data.epsodelist) {
        episodes = data.data.epsodelist;
    }
    let albumName = "", albumPic = "", albumDesc = "", directors = [], actors = [];
    // 专辑详情
    const tvId = episodes.length ? episodes[0].tvId : albumId;
    if (tvId) {
        const baseData = await getJson(API + "/video/video/baseinfo/" + tvId);
        if (baseData && baseData.code === "A00000" && baseData.data) {
            const b = baseData.data;
            albumName = b.albumName || "";
            albumPic = b.albumImageUrl || "";
            albumDesc = b.description || "";
            if (b.people) {
                directors = (b.people.director || []).map(function (d) { return d.name || ""; }).filter(function (s) { return s; });
                actors = (b.people.main_charactor || []).map(function (a) { return a.name || ""; }).filter(function (s) { return s; });
            }
            // 电影无剧集时用 baseinfo 补充
            if (!episodes.length && b.playUrl) {
                episodes = [{ shortTitle: b.name || albumName, name: b.name || albumName, playUrl: b.playUrl }];
            }
        }
    }
    // 兜底从剧集取
    const fe = episodes[0] || {};
    if (!albumName) albumName = fe.name || fe.shortTitle || "";
    if (!albumPic) albumPic = fe.imageUrl || "";
    if (!albumDesc) albumDesc = fe.description || "";
    if (!directors.length && fe.people) directors = (fe.people.director || []).map(function (d) { return d.name || ""; }).filter(function (s) { return s; });
    if (!actors.length && fe.people) actors = (fe.people.main_charactor || []).map(function (a) { return a.name || ""; }).filter(function (s) { return s; });
    // 播放列表(www→m 提升兼容)
    const playUrls = [];
    for (const ep of episodes) {
        const epName = ep.shortTitle || ep.name || "";
        let epUrl = ep.playUrl || "";
        if (epUrl) {
            epUrl = epUrl.replace("http://www.iqiyi.com/", "https://m.iqiyi.com/").replace("https://www.iqiyi.com/", "https://m.iqiyi.com/");
            playUrls.push(epName + "$" + epUrl);
        }
    }
    albumDesc = (albumDesc || "").replace(/\n\n/g, "\n").trim();
    list.push({
        vod_id: videoId,
        vod_name: albumName,
        vod_pic: albumPic,
        vod_remarks: episodes.length > 1 ? "共" + episodes.length + "集" : ((fe.duration || "") || "电影"),
        vod_actor: actors.slice(0, 8).join(" "),
        vod_director: directors.slice(0, 3).join(" "),
        vod_content: "【琉🔹璃❤广告勿信👉剧情】📢" + albumDesc,
        vod_play_from: "爱奇艺",
        vod_play_url: playUrls.join("#")
    });
    return JSON.stringify({ list: list });
}

async function play(flag, id, flags) {
    let playUrl = String(id);
    if (playUrl.indexOf("$") >= 0) playUrl = playUrl.split("$").pop();
    if (/^http/.test(playUrl)) {
        playUrl = playUrl.replace("http://www.iqiyi.com/", "https://m.iqiyi.com/").replace("https://www.iqiyi.com/", "https://m.iqiyi.com/");
    }
    // 交壳: 走全局 parses 解析链
    return JSON.stringify({
        parse: 1,
        jx: "1",
        url: playUrl,
        header: { "User-Agent": UA, "Referer": "https://m.iqiyi.com/", "Origin": "https://m.iqiyi.com" }
    });
}

async function search(wd, quick, pg) {
    const page = parseInt(pg) || 1;
    const url = SAPI + "/o?" + qs({ if: "html5", key: wd, pageNum: page, pageSize: "25" });
    const data = await getJson(url);
    const videos = [];
    if (data && data.data && data.data.docinfos) {
        for (const item of data.data.docinfos) {
            const a = item.albumDocInfo || {};
            if (a.albumId && a.albumTitle) {
                videos.push({
                    vod_id: String(a.albumId),
                    vod_name: a.albumTitle,
                    vod_pic: a.albumVImage || a.albumImg || "",
                    vod_remarks: a.tvFocus || ((a.itemTotalNumber || 0) + "集")
                });
            }
        }
    }
    return JSON.stringify({ list: videos, page: page, pagecount: 999, limit: 25, total: videos.length });
}

export default { init, home, homeVod, category, detail, play, search };