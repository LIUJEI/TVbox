// 芒果TV (mgtv.com 官方API) - QuickJS 版
const RHOST = "https://www.mgtv.com";
const HOST = "https://pianku.api.mgtv.com";
const VHOST = "https://pcweb.api.mgtv.com";
const MHOST = "https://dc.bz.mgtv.com";
const SHOST = "https://mobileso.bz.mgtv.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.61 Chrome/126.0.6478.61 Not/A)Brand/8  Safari/537.36";
const HEADERS = { "User-Agent": UA, "origin": RHOST, "referer": RHOST + "/" };

// 解析回退链: 严格按顺序, 第一个失效才跳下一个
const JX_APIS = [
    "https://api.jxapi.cc/api/?key=e0df4139f1e7f09375e864cc4937570e&url=",
    "http://zxy-th1.jsszks.dpdns.org:8090/?url=",
    "https://test1.12321app.com/daoliansiquanjia.php?url="
];

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

function isPlayUrl(u) {
    return /^https?:\/\//.test(u || "") && /\.(m3u8|mp4|flv)(\?|$)/i.test(u || "");
}

async function checkPlayable(u) {
    // 只深度校验 m3u8 (拉内容确认存在); mp4/flv 大文件不下载直接放行
    if (!/\.m3u8(\?|$)/i.test(u)) return true;
    try {
        const r = await req(u, { headers: { "User-Agent": UA }, timeout: 5000 });
        const c = (r && r.content) || "";
        return c.indexOf("#EXTM3U") >= 0;
    } catch (e) { return false; }
}

async function jxFallback(pageUrl) {
    for (const api of JX_APIS) {
        let u = "";
        try {
            const r = await req(api + encodeURIComponent(pageUrl), { headers: { "User-Agent": UA }, timeout: 8000 });
            const j = JSON.parse((r && r.content) || "{}");
            const cand = (j && (j.url || (j.result && j.result.url))) || "";
            if (isPlayUrl(cand)) u = String(cand);
        } catch (e) {}
        // 直链可访问才算成功, 死链跳下一个解析
        if (u && (await checkPlayable(u))) return u;
    }
    return "";
}

async function home(filter) {
    const cateManual = {
        "电影": "3",
        "电视剧": "2",
        "综艺": "1",
        "动画": "50",
        "少儿": "10",
        "纪录片": "51",
        "教育": "115"
    };
    const classes = [], filters = {};
    const ids = [], jobs = [];
    for (const k in cateManual) {
        classes.push({ type_name: k, type_id: cateManual[k] });
        ids.push(cateManual[k]);
        const params = { allowedRC: "1", channelId: cateManual[k], platform: "pcweb", _support: "10000000" };
        jobs.push(getJson(HOST + "/rider/config/channel/v1?" + qs(params)).catch(function () { return null; }));
    }
    const datas = await Promise.all(jobs);
    datas.forEach(function (data, i) {
        const id = ids[i];
        const ft = [];
        try {
            for (const item of data.data.listItems) {
                const va = [];
                for (const value of (item.items || [])) {
                    if (value.tagName) va.push({ n: value.tagName, v: value.tagId });
                }
                if (va.length) ft.push({ key: item.eName, name: item.typeName, value: va });
            }
        } catch (e) {}
        if (ft.length) filters[id] = ft;
    });
    return JSON.stringify({ class: classes, filters: filters });
}

async function homeVod() {
    const url = MHOST + "/dynamic/v1/channel/index/0/0/0/1000000/0/0/17/1354?type=17&version=5.0&t=" + Date.now() + "&_support=10000000";
    const data = await getJson(url);
    const list = [];
    if (data && data.data) {
        for (const i of data.data) {
            const dsl = i.DSLList || [];
            for (const j of dsl) {
                const items = (j.data && j.data.items) || [];
                for (const k of items) {
                    list.push({
                        vod_id: k.videoId,
                        vod_name: k.videoName,
                        vod_pic: k.img,
                        vod_year: k.cornerTitle,
                        vod_remarks: k.time || k.desc
                    });
                }
            }
        }
    }
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg) || 1;
    const ext = extend || {};
    const params = {
        allowedRC: "1",
        platform: "pcweb",
        channelId: tid,
        pn: page,
        pc: "80",
        hudong: "1",
        _support: "10000000"
    };
    for (const k in ext) params[k] = ext[k];
    const data = await getJson(HOST + "/rider/list/pcweb/v3?" + qs(params));
    const list = [];
    if (data && data.data && data.data.hitDocs) {
        for (const i of data.data.hitDocs) {
            list.push({
                vod_id: i.playPartId,
                vod_name: i.title,
                vod_pic: i.img,
                vod_year: (i.rightCorner && i.rightCorner.text) || i.year,
                vod_remarks: i.updateInfo
            });
        }
    }
    return JSON.stringify({ list: list, page: page, pagecount: list.length ? 9999 : page, limit: list.length, total: 999999 });
}

async function fetchPageData(page, vid) {
    const params = {
        version: "5.5.35", video_id: vid, page: page, size: "30",
        platform: "4", src: "mgtv", allowedRC: "1", _support: "10000000"
    };
    const data = await getJson(VHOST + "/episode/list?" + qs(params));
    const ldata = [];
    if (data && data.data && data.data.list) {
        for (const i of data.data.list) {
            ldata.push(i.t3 + "$" + i.url);
        }
    }
    return { data: data, list: ldata };
}

async function detail(ids) {
    const vid = String(Array.isArray(ids) ? ids[0] : ids);
    const params = { allowedRC: "1", vid: vid, type: "b", _support: "10000000" };
    const vdata = await getJson(VHOST + "/video/info?" + qs(params));
    if (!vdata || !vdata.data || !vdata.data.info) {
        return JSON.stringify({ list: [{ vod_id: vid, vod_name: "加载失败", vod_play_from: "", vod_play_url: "" }] });
    }
    const d = vdata.data.info.detail || {};
    const first = await fetchPageData(1, vid);
    let pdata = first.list;
    const pagecount = (first.data && first.data.data && first.data.data.total_page) || 1;
    if (pagecount > 1) {
        const pages = [];
        for (let p = 2; p <= pagecount; p++) pages.push(p);
        const results = await Promise.all(pages.map(function (p) { return fetchPageData(p, vid); }));
        for (const r of results) pdata = pdata.concat(r.list);
    }
    return JSON.stringify({
        list: [{
            vod_id: vid,
            vod_name: vdata.data.info.title,
            type_name: d.kind || "",
            vod_year: d.releaseTime || "",
            vod_area: d.area || "",
            vod_lang: d.language || "",
            vod_remarks: d.updateInfo || "",
            vod_actor: d.leader || "",
            vod_director: d.director || "",
            vod_content: "【琉🔹璃❤广告勿信👉剧情】📢" + (d.story || ""),
            vod_play_from: "芒果TV",
            vod_play_url: pdata.join("#")
        }]
    });
}

async function play(flag, id, flags) {
    let fullUrl = String(id);
    if (fullUrl.indexOf("$") >= 0) fullUrl = fullUrl.split("$").pop();
    if (!/^http/.test(fullUrl)) fullUrl = RHOST + fullUrl;
    // 解析链严格顺序: 麒麟→观潮→急速, 全失败交壳嗅探
    const parsed = await jxFallback(fullUrl);
    if (parsed) {
        return JSON.stringify({ parse: 0, url: parsed, header: { "User-Agent": UA } });
    }
    return JSON.stringify({
        jx: 1,
        parse: 1,
        url: fullUrl,
        header: { "User-Agent": UA, "Referer": RHOST + "/" }
    });
}

async function search(wd, quick, pg) {
    const page = parseInt(pg) || 1;
    const url = SHOST + "/applet/search/v1?channelCode=mobile-wxap&q=" + encodeURIComponent(wd) + "&pn=" + page + "&pc=10&_support=10000000";
    const data = await getJson(url);
    const list = [];
    if (data && data.data && data.data.contents) {
        for (const i of data.data.contents) {
            if (i.data && i.data.length) {
                const k = i.data[0];
                if (k.vid && k.img) {
                    list.push({
                        vod_id: k.vid,
                        vod_name: k.title,
                        vod_pic: k.img,
                        vod_year: (i.rightTopCorner && i.rightTopCorner.text) || "",
                        vod_remarks: (i.desc || []).join("/")
                    });
                }
            }
        }
    }
    return JSON.stringify({ list: list, page: page });
}

export default { init, home, homeVod, category, detail, play, search };
