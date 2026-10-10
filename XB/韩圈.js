// 韩小圈 (jennyhow.com) - QuickJS 版
// 源: AES加壳Python爬虫解密后移植
const HOST = "https://www.jennyhow.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADERS = { "User-Agent": UA, "Referer": HOST };

function request(url) {
    return req(url, { headers: HEADERS }).then(r => r.content || "");
}

function formatPic(pic) {
    if (!pic) return "";
    if (pic.startsWith("//")) return "https:" + pic;
    if (pic.startsWith("/")) return HOST + pic;
    return pic;
}

function stripTags(s) {
    return (s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// 解析列表卡片（首页/分类页通用）
function parseItems(html) {
    const list = [];
    const blocks = html.split(/<div class="module-item["\s]/);
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i].slice(0, 4000);
        const mA = block.match(/<a[^>]*href="([^"]+)"[^>]*title="([^"]*)"/) || block.match(/<a[^>]*href="([^"]+)"[^>]*>/);
        if (!mA) continue;
        const href = mA[1];
        let name = mA[2] || "";
        const mImg = block.match(/<img[^>]*data-src="([^"]+)"/) || block.match(/<img[^>]*data-original="([^"]+)"/) || block.match(/<img[^>]*src="([^"]+)"/);
        if (!name && mImg) {
            const mAlt = block.match(/alt="([^"]*)"/);
            name = mAlt ? mAlt[1] : "";
        }
        if (!name) {
            const mText = block.match(/<a[^>]*href="[^"]+"[^>]*>([\s\S]*?)<\/a>/);
            name = mText ? stripTags(mText[1]) : "";
        }
        const mNote = block.match(/<div class="module-item-(?:text|note)"[^>]*>([\s\S]*?)<\/div>/);
        const remarks = mNote ? stripTags(mNote[1]) : "";
        list.push({
            vod_id: href,
            vod_name: name || "未知名称",
            vod_pic: formatPic(mImg ? mImg[1] : ""),
            vod_remarks: remarks
        });
    }
    return list;
}

function init(ext) {}

async function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: "/hxq/1.html", type_name: "最新韩剧" },
            { type_id: "/hxq/2.html", type_name: "韩国电影" },
            { type_id: "/hxq/3.html", type_name: "韩国综艺" },
            { type_id: "/hxq/4.html", type_name: "韩国动漫" }
        ]
    });
}

async function homeVod() {
    const html = await request(HOST);
    return JSON.stringify({ list: parseItems(html) });
}

async function category(tid, pg, filter, extend) {
    // 兼容数字 tid 与路径 tid
    const map = { "1": "/hxq/1.html", "2": "/hxq/2.html", "3": "/hxq/3.html", "4": "/hxq/4.html",
                  "20": "/hxq/1.html", "21": "/hxq/2.html", "22": "/hxq/3.html", "23": "/hxq/4.html" };
    let path = map[tid] || tid;
    if (!path.startsWith("http")) path = HOST + path;
    const pn = Math.max(parseInt(pg) || 1, 1);
    if (pn > 1) path = path.replace(/\.html$/, `-${pn}.html`);
    const html = await request(path);
    const videos = parseItems(html);
    return JSON.stringify({
        page: pn,
        pagecount: videos.length > 0 ? pn + 1 : pn,
        limit: 24,
        total: 0,
        list: videos
    });
}

async function detail(ids) {
    const id = ids[0];
    let url = id;
    if (!url.startsWith("http")) url = HOST + url;
    const html = await request(url);
    if (!html) return JSON.stringify({ list: [] });

    const metaContent = (prop) => {
        const m = html.match(new RegExp(`<meta[^>]*property="og:${prop}"[^>]*content="([^"]*)"`));
        return m ? m[1] : "";
    };

    let title = metaContent("title");
    if (!title) {
        const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        title = m ? stripTags(m[1]) : "未知名称";
    }
    let pic = metaContent("image");
    if (!pic) {
        const m = html.match(/<img[^>]*class="[^"]*lazy(?:load)?[^"]*"[^>]*data-src="([^"]+)"/) ||
                  html.match(/<img[^>]*class="[^"]*lazy(?:load)?[^"]*"[^>]*src="([^"]+)"/);
        pic = m ? m[1] : "";
    }
    const director = metaContent("video:director");
    const actor = metaContent("video:actor");
    // 年份取「上映」项；简介取「剧情」项
    const infoItem = (label) => {
        const re = new RegExp(`<span class="video-info-itemtitle">${label}[：:]</span>[\\s\\S]*?<div class="video-info-item[^"]*"[^>]*>([\\s\\S]*?)</div>`);
        const m = html.match(re);
        return m ? stripTags(m[1]) : "";
    };
    const year = infoItem("上映") || infoItem("年份");
    let content = infoItem("剧情") || infoItem("简介");
    // 清洗简介里的 @广告@
    content = content.replace(/@[^@]+@/g, "").trim();
    if (!content) {
        const m = html.match(/<div class="module-info-introduction-content[^"]*"[^>]*>([\s\S]*?)<\/div>/) ||
                  html.match(/<div class="module-info-introduction[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        content = m ? stripTags(m[1]).replace(/@[^@]+@/g, "").trim() : "";
    }

    // 线路 tabs -> 播放列表
    const playFrom = [];
    const playUrl = [];
    const tabsArea = html.match(/<ul class="nav1 nav-tabs[^"]*"[^>]*>([\s\S]*?)<\/ul>/) ||
                     html.match(/<ul class="[^"]*nav-tabs[^"]*"[^>]*>([\s\S]*?)<\/ul>/);
    if (tabsArea) {
        const tabRe = /<a[^>]*href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let tm;
        while ((tm = tabRe.exec(tabsArea[1])) !== null) {
            const targetId = tm[1];
            // 线路名剥掉图标和集数小标签
            const lineName = stripTags(tm[2].replace(/<small>[\s\S]*?<\/small>/, "")) || "线路";
            // 找对应容器
            const boxRe = new RegExp(`<div id="${targetId}"[^>]*>([\\s\\S]*?)</div>`, "");
            const box = html.match(boxRe);
            if (!box) continue;
            const epRe = /<a[^>]*title="([^"]*)"[^>]*href="([^"]+)"/g;
            const eps = [];
            let em;
            while ((em = epRe.exec(box[1])) !== null) {
                const epName = em[1] || "";
                const epHref = em[2] || "";
                if (epHref) eps.push(`${epName}$${epHref}`);
            }
            if (eps.length) {
                playFrom.push(lineName);
                playUrl.push(eps.join("#"));
            }
        }
    }
    // 兜底：无 tabs 时全页面抓播放链接
    if (playFrom.length === 0) {
        const epRe = /<a[^>]*href="(\/play\/[^"]+)"[^>]*>([^<]*)<\/a>/g;
        const eps = [];
        let em;
        while ((em = epRe.exec(html)) !== null) {
            const epName = stripTags(em[2]) || em[1];
            eps.push(`${epName}$${em[1]}`);
        }
        if (eps.length) {
            playFrom.push("默认线路");
            playUrl.push(eps.join("#"));
        }
    }

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: title,
            vod_pic: formatPic(pic),
            vod_director: director,
            vod_actor: actor,
            vod_year: year,
            vod_content: content,
            vod_play_from: playFrom.join("$$$"),
            vod_play_url: playUrl.join("$$$")
        }]
    });
}

async function play(flag, id, flags) {
    let url = id;
    if (!url.startsWith("http")) url = HOST + url;
    const html = await request(url);
    // 直链：var now='...m3u8'
    const m = html.match(/var now=['"]([^'"]+)['"]/);
    if (m && m[1]) {
        return JSON.stringify({ parse: 0, url: m[1], header: { "User-Agent": UA, "Referer": HOST } });
    }
    // player_aaaa JSON
    const mj = html.match(/player_aaaa\s*=\s*(\{[^}]+\})/);
    if (mj) {
        try {
            const data = JSON.parse(mj[1]);
            if (data.url) {
                return JSON.stringify({ parse: 0, url: data.url, header: { "User-Agent": UA, "Referer": HOST } });
            }
        } catch (e) {}
    }
    // 兜底交壳嗅探
    return JSON.stringify({ parse: 1, url: url, header: { "User-Agent": UA, "Referer": HOST } });
}

// 站点搜索页(search.php/vodsearch)有CC防火墙503，直接返回空避免卡死
async function search(wd, quick, pg) {
    return JSON.stringify({ list: [] });
}

export default { init, home, homeVod, category, detail, play, search };
