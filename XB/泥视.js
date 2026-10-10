// 泥视频 (nivod.cc) - QuickJS 版
const HOST = "https://www.nivod.cc";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const PLACEHOLDER = "https://image.tmdb.org/t/p/w600_and_h900_bestv2/placeholder.jpg";

const HEADERS = {
    "User-Agent": UA,
    "Referer": HOST + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9"
};

async function getHtml(url) {
    const r = await req(url, { headers: HEADERS });
    return (r && r.content) || "";
}

async function getJson(url) {
    const txt = await getHtml(url);
    try { return JSON.parse(txt); } catch (e) { return null; }
}

function fixPic(p) {
    if (!p) return PLACEHOLDER;
    if (p.startsWith("/")) return HOST + p;
    return p;
}

// 首页/搜索卡片: div.qy-mod-link-wrap > a（或 a.qy-mod-link）
function parseModLinks(html) {
    const list = [], seen = {};
    const handle = (href, block, fullTag) => {
        if (seen[href]) return;
        seen[href] = 1;
        let name = "";
        const im = block.match(/<picture[^>]*class="video-item-preview-img"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"/i) ||
                   block.match(/<img[^>]*alt="([^"]*)"/i);
        if (im) name = im[1].trim();
        if (!name) {
            const tm = (fullTag || "").match(/title="([^"]*)"/);
            name = tm ? tm[1].trim() : "未知";
        }
        let pic = "";
        const pm = block.match(/<picture[^>]*class="video-item-preview-img"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"/i) ||
                   block.match(/<img[^>]*src="([^"]*)"/i);
        if (pm) pic = pm[1];
        let remark = "";
        const rm = block.match(/<span[^>]*class="[^"]*qy-mod-label[^"]*"[^>]*>([\s\S]*?)<\/span>/);
        if (rm) remark = rm[1].replace(/<[^>]+>/g, "").trim();
        list.push({ vod_id: href, vod_name: name, vod_pic: fixPic(pic), vod_remarks: remark });
    };
    // 1) div.qy-mod-link-wrap 包裹的 a
    const re1 = /<div\b[^>]*class="[^"]*qy-mod-link-wrap[^"]*"[^>]*>\s*(<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>)/g;
    let m;
    while ((m = re1.exec(html)) !== null) {
        const aTag = m[1], href = m[2];
        const am = aTag.match(/^(<a\b[^>]*>)([\s\S]*?)<\/a>$/);
        if (am) handle(href, am[2], am[1]);
    }
    // 2) a.qy-mod-link
    const re2 = /<a\b[^>]*class="[^"]*qy-mod-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    while ((m = re2.exec(html)) !== null) {
        handle(m[1], m[2], "");
    }
    return list;
}

// 分类列表: li.qy-mod-li
function parseModLi(html) {
    const list = [], seen = {};
    const re = /<li\b[^>]*class="[^"]*qy-mod-li[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const block = m[1];
        const hm = block.match(/<a[^>]*href="([^"]+)"/);
        if (!hm) continue;
        const href = hm[1];
        if (seen[href]) continue;
        seen[href] = 1;
        let name = "未知";
        const tm = block.match(/<a[^>]*title="([^"]*)"/);
        if (tm) name = tm[1].trim();
        let pic = "";
        const sm = block.match(/<div[^>]*class="qy-mod-cover"[^>]*style="([^"]*)"/);
        if (sm) {
            const um = sm[1].match(/url\((.*?)\)/);
            if (um) pic = um[1].trim();
        }
        let remark = "";
        const rm = block.match(/<span[^>]*class="qy-mod-label"[^>]*>([\s\S]*?)<\/span>/);
        if (rm) remark = rm[1].replace(/<[^>]+>/g, "").trim();
        list.push({ vod_id: href, vod_name: name, vod_pic: fixPic(pic), vod_remarks: remark });
    }
    return list;
}

function divText(html, id) {
    const re = new RegExp(`<div[^>]*id="${id}"[^>]*>([\\s\\S]*?)</div>`);
    const m = html.match(re);
    return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function init(ext) {}

async function home(filter) {
    const classes = [
        { type_id: "movie", type_name: "电影" },
        { type_id: "tv", type_name: "电视剧" },
        { type_id: "show", type_name: "综艺" },
        { type_id: "anime", type_name: "动漫" }
    ];
    const result = { class: classes };
    if (filter) {
        const mk = (s) => s.split("#").map(v => ({ n: v.split("$")[0], v: v.split("$")[1] }));
        const mky = (arr) => arr.map(v => ({ n: v, v: v }));
        result.filters = {
            "movie": [
                { key: "class", name: "剧情", value: mk("冒险$mao-xian#剧情$ju-qing#动作$dong-zuo#同性$tong-xing#喜剧$xi-ju#奇幻$qi-huan#恐怖$kong-bu#悬疑$xuan-yi#惊悚$jing-song#战争$zhan-zheng#歌舞$ge-wu#灾难$zai-nan#爱情$ai-qing#犯罪$fan-zui#科幻$ke-huan") },
                { key: "area", name: "地区", value: mk("大陆$cn#香港$hk#台湾$tw#欧美$west#泰国$th#新马$sg-my#其他$other") },
                { key: "year", name: "年份", value: mky(["2025","2024","2023","2022","2021","2020","2019-2010","2009-2000","90年代","80年代","更早"]) }
            ],
            "tv": [
                { key: "class", name: "剧情", value: mk("剧情$ju-qing#动作$dong-zuo#历史$li-shi#历险$mao-xian#古装$gu-zhuang#同性$tong-xing#喜剧$xi-ju#奇幻$qi-huan#家庭$jia-ting#悬疑$xuan-yi#惊悚$jing-song#战争$zhan-zheng#武侠$wu-xia#爱情$ai-qing#科幻$ke-huan#罪案$zui-an") },
                { key: "area", name: "地区", value: mk("大陆$cn#香港$hk#台湾$tw#日本$jp#韩国$kr#欧美$west#泰国$th#新马$sg-my") },
                { key: "year", name: "年份", value: mky(["2025","2024","2023","2022","2021","2020","2019-2015","2014-2010","2009-2000","90年代","80年代","更早"]) }
            ],
            "show": [
                { key: "class", name: "剧情", value: mk("搞笑$gao-xiao#音乐$yin-yue#真人秀$zhen-ren-xiu#脱口秀$tuo-kou-xiu") },
                { key: "area", name: "地区", value: mk("大陆$cn#韩国$kr#欧美$west#其它$other") },
                { key: "year", name: "年份", value: mky(["2025","2024","2023","2022","2021","2020","2019-2015","2014-2010","2009-2000","90年代","80年代","更早"]) }
            ],
            "anime": [
                { key: "class", name: "剧情", value: mk("冒险$mao-xian#动画电影$movie#推理$tui-li#校园$xiao-yuan#治愈$zhi-yu#泡面$pao-mian#热血$re-xue#科幻$ke-huan#魔幻$mo-huan") },
                { key: "area", name: "地区", value: mk("大陆$cn#日本$jp#欧美$west") },
                { key: "year", name: "年份", value: mky(["2025","2024","2023","2022","2021","2020","2019-2015","2014-2010","2009-2000","90年代","80年代","更早"]) }
            ]
        };
    }
    return JSON.stringify(result);
}

async function homeVod() {
    const html = await getHtml(HOST + "/");
    return JSON.stringify({ list: parseModLinks(html).slice(0, 10) });
}

async function category(tid, pg, filter, extend) {
    const pn = parseInt(pg) || 1;
    if (pn > 5) {
        return JSON.stringify({ list: [], page: pn, pagecount: 5, limit: 0, total: 240 });
    }
    const ext = extend || {};
    const params = "channel=" + encodeURIComponent(tid) +
        "&region=" + encodeURIComponent(ext.area || "") +
        "&class=" + encodeURIComponent(ext.class || "") +
        "&year=" + encodeURIComponent(ext.year || "") +
        "&page=" + pn;
    const html = await getHtml(HOST + "/filter.html?" + params);
    const list = parseModLi(html);
    const cur = list.length;
    let totalPages = 5;
    if (cur < 48) totalPages = pn;
    const total = totalPages === pn ? (pn - 1) * 48 + cur : totalPages * 48;
    return JSON.stringify({ list: list, page: pn, pagecount: totalPages, limit: cur, total: total });
}

async function detail(ids) {
    const id = Array.isArray(ids) ? ids[0] : ids;
    const url = HOST + id;
    const html = await getHtml(url);
    if (!html) {
        return JSON.stringify({ list: [{ vod_id: id, vod_name: "未知", vod_pic: PLACEHOLDER, vod_play_from: "泥視頻", vod_play_url: "" }] });
    }

    let name = "";
    const nm = html.match(/<div[^>]*class="right-title"[^>]*>([\s\S]*?)<\/div>/);
    if (nm) name = nm[1].replace(/<[^>]+>/g, "").trim();

    let pic = PLACEHOLDER;
    const pm = html.match(/<img[^>]*class="left-img"[^>]*src="([^"]*)"/);
    if (pm) pic = fixPic(pm[1]);

    const vod = {
        vod_id: id,
        vod_name: name || "未知",
        vod_pic: pic,
        type_name: "",
        vod_year: divText(html, "postYear"),
        vod_area: divText(html, "region"),
        vod_remarks: divText(html, "updateTxt"),
        vod_actor: divText(html, "actors"),
        vod_director: divText(html, "director"),
        vod_content: divText(html, "show-desc")
    };

    // 剧集: div#list-jj > a
    const eps = [];
    const listJj = html.match(/<div[^>]*id="list-jj"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (listJj) {
        let m;
        const re2 = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        while ((m = re2.exec(listJj[1])) !== null) {
            const href = m[1], block = m[2];
            const im = block.match(/<div[^>]*class="item"[^>]*>([\s\S]*?)<\/div>/);
            const epName = im ? im[1].replace(/<[^>]+>/g, "").trim() : "未知";
            eps.push({ name: epName, url: href });
        }
    }

    if (!eps.length) {
        vod.vod_play_from = "泥視頻";
        vod.vod_play_url = "第1集$https://www.nivod.cc/vodplay/202552243/ep1";
        return JSON.stringify({ list: [vod] });
    }

    // 倒序遍历 + 并发取每集 playinfo
    const vid = id.split("/")[2];
    const revEps = eps.slice().reverse();
    const tasks = revEps.map(ep => {
        const epId = ep.url.split("/").pop();
        return getJson(`${HOST}/xhr_playinfo/${vid}-${epId}`).then(data => ({ ep, data }));
    });
    const results = await Promise.all(tasks);

    const playFrom = [];
    const playUrls = {};
    for (const r of results) {
        const data = r.data;
        if (!data || !data.pdatas || !data.pdatas.length) continue;
        for (const source of data.pdatas) {
            const sName = source.from;
            if (!playUrls[sName]) {
                playUrls[sName] = [];
                playFrom.push(sName);
            }
            playUrls[sName].push(r.ep.name + "$" + source.playurl);
        }
    }

    vod.vod_play_from = playFrom.join("$$$");
    vod.vod_play_url = playFrom.map(s => playUrls[s].join("#")).join("$$$");
    return JSON.stringify({ list: [vod] });
}

async function play(flag, id, flags) {
    const url = id.indexOf("$") >= 0 ? id.split("$")[1] : id;
    return JSON.stringify({ parse: 0, url: url, header: HEADERS });
}

async function search(wd, quick, pg) {
    const url = `${HOST}/search_x.html?keyword=${encodeURIComponent(wd)}&page=${parseInt(pg) || 1}`;
    const html = await getHtml(url);
    return JSON.stringify({ list: parseModLinks(html) });
}

export default { init, home, homeVod, category, detail, play, search };
