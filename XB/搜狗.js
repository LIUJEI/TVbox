// 搜狗视频·菜狗 (v.sogou.com) - QuickJS 版
const WAPT = "https://waptv.sogou.com";
const VSG = "https://v.sogou.com";
const PC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MOBILE_UA = "Mozilla/5.0 (Linux; Android 12; 22127RK46C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const HEADERS = { "User-Agent": PC_UA, "Referer": VSG + "/" };

async function getHtml(url, ua) {
    const h = { "User-Agent": ua || PC_UA, "Referer": VSG + "/" };
    const r = await req(url, { headers: h });
    return (r && r.content) || "";
}

// 提取 __INITIAL_STATE__ JSON（括号平衡）
function extractState(html) {
    const idx = html.indexOf("INITIAL_STATE");
    if (idx < 0) return null;
    const st = html.indexOf("{", idx);
    if (st < 0) return null;
    let depth = 0;
    for (let i = st; i < html.length; i++) {
        const c = html[i];
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (!depth) {
                try { return JSON.parse(html.slice(st, i + 1)); } catch (e) { return null; }
            }
        }
    }
    return null;
}

function pad2(n) { return n >= 10 ? String(n) : "0" + String(n); }

function mkFilters() {
    const years = [{ n: "全部", v: "" }];
    for (let y = 2023; y >= 2014; y--) years.push({ n: String(y), v: String(y) });
    years.push({ n: "更早", v: "更早" });
    const fv = (arr) => [{ n: "全部", v: "" }].concat(arr.map(x => ({ n: x, v: x })));
    const fee = fv(["正片", "免费正片", "付费正片"]);
    const order = fv(["最新", "好评"]);
    const zoneStd = fv(["内地", "香港", "台湾", "韩国", "泰国", "日本", "美国", "英国", "新加坡", "其他"]);
    return {
        "teleplay": [
            { key: "style", name: "类型", value: fv(["爱情", "喜剧", "都市", "悬疑", "古装", "偶像", "犯罪", "历史", "战争", "武侠", "警匪", "科幻", "奇幻", "谍战", "农村", "其他"]) },
            { key: "zone", name: "地区", value: zoneStd },
            { key: "year", name: "年代", value: years },
            { key: "fee", name: "资源", value: fee },
            { key: "order", name: "排序", value: order }
        ],
        "film": [
            { key: "style", name: "类型", value: fv(["喜剧", "爱情", "动作", "恐怖", "科幻", "惊悚", "犯罪", "奇幻", "战争", "悬疑", "动画", "文艺", "传记", "歌舞", "古装", "警匪", "其他"]) },
            { key: "zone", name: "地区", value: zoneStd },
            { key: "year", name: "年代", value: years },
            { key: "fee", name: "资源", value: fee },
            { key: "order", name: "排序", value: order }
        ],
        "cartoon": [
            { key: "style", name: "类型", value: fv(["搞笑", "热血", "冒险", "美少女", "科幻", "校园", "恋爱", "神魔", "机战", "益智", "亲子", "励志", "童话", "青春", "原创", "动作", "耽美", "魔幻", "其他"]) },
            { key: "zone", name: "地区", value: fv(["日本", "欧美", "国产", "其他"]) },
            { key: "year", name: "年代", value: years },
            { key: "fee", name: "资源", value: fee },
            { key: "order", name: "排序", value: order }
        ],
        "tvshow": [
            { key: "style", name: "类型", value: fv(["真人秀", "生活", "搞笑", "访谈", "时尚", "音乐", "选秀", "美食", "游戏", "纪实", "旅游", "情感", "恶搞", "吐槽", "原创", "歌舞", "播报", "曲艺", "科教", "其他"]) },
            { key: "zone", name: "地区", value: fv(["内地", "台湾", "日韩", "欧美", "其他"]) },
            { key: "order", name: "排序", value: order }
        ],
        "documentary": [
            { key: "style", name: "类型", value: fv(["历史", "自然", "动物", "社会", "传记", "人文", "文化", "军事", "科技", "人物", "探索", "美食", "旅行", "探险", "其他"]) },
            { key: "zone", name: "地区", value: zoneStd },
            { key: "year", name: "年代", value: years },
            { key: "fee", name: "资源", value: fee },
            { key: "order", name: "排序", value: order }
        ]
    };
}

// 分类 JSON → 列表
function parseApiList(j) {
    const list = [];
    const results = (j && j.listData && j.listData.results) || [];
    for (const it of results) {
        const ipl = it.ipad_play_for_list || {};
        let desc = "";
        if (ipl.finish_episode) {
            desc = ipl.episode === ipl.finish_episode ? ("全集" + ipl.finish_episode) : ("连载" + ipl.episode + "/" + ipl.finish_episode);
        }
        if (!desc && it.score) desc = "评分:" + it.score;
        if (!desc && it.date) desc = "更至:" + it.date;
        const url = VSG + String(it.url || "").replace("teleplay", "series").replace("cartoon", "series");
        list.push({
            vod_id: url,
            vod_name: it.name || "",
            vod_pic: it.v_picurl || "",
            vod_remarks: desc
        });
    }
    return list;
}

function init(ext) {}

async function home(filter) {
    const classes = [
        { type_id: "teleplay", type_name: "电视剧" },
        { type_id: "film", type_name: "电影" },
        { type_id: "cartoon", type_name: "动漫" },
        { type_id: "tvshow", type_name: "综艺" },
        { type_id: "documentary", type_name: "纪录片" }
    ];
    const result = { class: classes };
    if (filter) result.filters = mkFilters();
    return JSON.stringify(result);
}

async function homeVod() {
    const txt = await getHtml(WAPT + "/napi/video/classlist?abtest=0&iploc=CN1304&spver=&listTab=film&filter=&start=0&len=15&fr=filter");
    let j = null;
    try { j = JSON.parse(txt); } catch (e) {}
    return JSON.stringify({ list: parseApiList(j) });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg) || 1;
    const start = (page - 1) * 15;
    const ext = extend || {};
    const f = "style=" + (ext.style || "") + ";zone=" + (ext.zone || "") + ";year=" + (ext.year || "") +
              ";fee=" + (ext.fee || "") + ";order=" + (ext.order || "");
    const url = WAPT + "/napi/video/classlist?abtest=0&iploc=CN1304&spver=&listTab=" + encodeURIComponent(tid) +
                "&filter=" + encodeURIComponent(f) + "&start=" + start + "&len=15&fr=filter";
    const txt = await getHtml(url);
    let j = null;
    try { j = JSON.parse(txt); } catch (e) {}
    const list = parseApiList(j);
    const totalitems = (j && j.listData && parseInt(j.listData.totalitems)) || 0;
    let pagecount = totalitems > 0 ? Math.ceil(totalitems / 15) : (list.length ? page + 1 : page);
    return JSON.stringify({ list: list, page: page, pagecount: pagecount, limit: list.length, total: totalitems });
}

async function detail(ids) {
    const url = String(Array.isArray(ids) ? ids[0] : ids);
    const html = await getHtml(url);
    const j = extractState(html);
    if (!j || !j.detail || !j.detail.itemData) {
        return JSON.stringify({ list: [{ vod_id: url, vod_name: "未知", vod_play_from: "", vod_play_url: "" }] });
    }
    const d = j.detail.itemData;

    // 海报
    let pic = "";
    const pm = html.match(/id="thumb_img"[\s\S]*?<img[^>]*src="([^"]+)"/);
    if (pm) pic = pm[1];

    const name = d.name || "";
    const score = d.score ? d.score : "暂无";
    const starring = d.starring ? ("演员：" + String(d.starring).replace(/;/g, " ")) : ("声优：" + (d.shengyou || ""));
    const director = d.director ? ("导演：" + String(d.director).replace(/;/g, " ")) : name;

    const plays = (d.play && d.play.item_list) || [];
    const shows = d.play_from_open_index; // 综艺期数结构

    const playFrom = [], playUrl = [];
    plays.forEach(function (p, idex) {
        const tbn = (p.sitename && p.sitename[0]) || String(p.site || "").replace(".com", "");
        const eps = [];
        if (p.info && Array.isArray(p.info) && p.info.length > 1) {
            for (const its of p.info.slice(1)) {
                eps.push(String(its.index) + "$" + its.url);
            }
        }
        if (shows && shows.item_list && shows.item_list[idex]) {
            const zy = shows.item_list[idex];
            (zy.date || []).forEach(function (date) {
                (date.day || []).forEach(function (dy) {
                    const dayy = pad2(dy[0]);
                    const Tdate = date.year + date.month + dayy;
                    const eu = VSG + "/vc/eplay?query=" + Tdate + "&date=" + Tdate + "&key=" + d.dockey + "&st=5&tvsite=" + p.site;
                    eps.push("第" + Tdate + "期$" + eu);
                });
            });
        } else if (!eps.length && p.site && p.url) {
            const isTrailer = (p.flag_list || []).indexOf("trailer") >= 0;
            eps.push(tbn + (isTrailer ? "—预告" : "") + "$" + VSG + p.url);
        }
        if (eps.length) {
            playFrom.push(tbn);
            playUrl.push(eps.join("#"));
        }
    });

    return JSON.stringify({
        list: [{
            vod_id: url,
            vod_name: name,
            vod_pic: pic,
            type_name: d.style || "",
            vod_year: "",
            vod_area: d.zone || "",
            vod_remarks: (d.style || "") + " 评分:" + score + "," + (d.update_wordstr || ""),
            vod_actor: starring,
            vod_director: director,
            vod_content: d.introduction || "",
            vod_play_from: playFrom.join("$$$"),
            vod_play_url: playUrl.join("$$$")
        }]
    });
}

// 内置解析回退链: 严格按顺序尝试, 第一个失效跳下一个
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
    for (const api of JX_APIS) {
        try {
            const r = await req(api + enc, { headers: { "User-Agent": PC_UA } });
            const j = JSON.parse((r && r.content) || "{}");
            const u = (j && (j.url || (j.result && j.result.url))) || "";
            if (isPlayUrl(u)) return String(u);
        } catch (e) {}
    }
    return "";
}

async function play(flag, id, flags) {
    let playUrl = id;
    if (!/^https?:\/\//.test(playUrl)) playUrl = VSG + (playUrl.startsWith("/") ? playUrl : "/" + playUrl);
    const html = await getHtml(playUrl, MOBILE_UA);
    const m = html.match(/window\.open\('(.*?)',/);
    let rurl = "";
    if (m && m[1]) {
        rurl = m[1];
        if (rurl.startsWith("//")) rurl = "https:" + rurl;
        else if (!/^https?:\/\//.test(rurl)) rurl = VSG + rurl;
    } else {
        rurl = playUrl;
    }
    // 内置解析链(麒麟→观潮→急速, 严格顺序) → 全失效交壳嗅探
    const parsed = await jxFallback(rurl);
    if (parsed) {
        return JSON.stringify({ parse: 0, url: parsed, header: { "User-Agent": MOBILE_UA } });
    }
    return JSON.stringify({ parse: 1, url: rurl, header: { "User-Agent": MOBILE_UA, "Referer": VSG + "/" } });
}

async function search(wd, quick, pg) {
    const url = WAPT + "/film/result?ie=utf8&query=" + encodeURIComponent(wd);
    const html = await getHtml(url);
    const j = extractState(html);
    const list = [];
    if (j && j.result && j.result.resultData && j.result.resultData.searchData) {
        const results = j.result.resultData.searchData.results || [];
        for (const it of results) {
            list.push({
                vod_id: VSG + String(it.tiny_url || "").replace(/teleplay|cartoon/g, "series"),
                vod_name: it.name || "",
                vod_pic: it.v_picurl || "",
                vod_remarks: (it.listCategory || []).join(",") + (it.score ? " 评分:" + it.score : "")
            });
        }
    }
    return JSON.stringify({ list: list, page: 1 });
}

export default { init, home, homeVod, category, detail, play, search };
