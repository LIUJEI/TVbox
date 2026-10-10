// 腾讯视频 (v.qq.com 官方API) - QuickJS 版
const HOST = "https://v.qq.com";
const APIHOST = "https://pbaccess.video.qq.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5410.0 Safari/537.36";
const HEADERS = { "User-Agent": UA, "origin": HOST, "referer": HOST + "/" };

// 解析回退链: 严格按顺序, 第一个失效才跳下一个
const JX_APIS = [
    "https://api.jxapi.cc/api/?key=e0df4139f1e7f09375e864cc4937570e&url=",
    "http://zxy-th1.jsszks.dpdns.org:8090/?url=",
    "https://test1.12321app.com/daoliansiquanjia.php?url=",
    "https://bfq.txnp.cn/excessive?url="
];

const DBODY = {
    page_params: {
        channel_id: "",
        filter_params: "sort=75",
        page_type: "channel_operation",
        page_id: "channel_list_second_page"
    }
};

// 分类分页状态 (page_context 跨调用保持, 与原版 self.body 一致)
let catBody = null;

function init(ext) {}

async function postJson(url, body) {
    const r = await req(url, {
        method: "POST",
        headers: HEADERS,
        body: body,
        postType: "json"
    });
    try { return JSON.parse((r && r.content) || "{}"); } catch (e) { return null; }
}

function cleanText(t) {
    if (!t) return "";
    return String(t).replace(/<script[^>]*>[\s\S]*?<\/script>/g, "").replace(/<style[^>]*>[\s\S]*?<\/style>/g, "").trim();
}

function paramsToStr(params) {
    const q = [];
    for (const k in params) q.push(k + "=" + params[k]);
    return q.join("&");
}

// 解析 item_data 通用: 取 cid 视频
function pickVideoItems(j) {
    if (!j || !j.data || !j.data.module_list_datas) return [];
    for (const mld of j.data.module_list_datas) {
        for (const md of (mld.module_datas || [])) {
            const items = (md.item_data_lists && md.item_data_lists.item_datas) || [];
            const cids = items.filter(function (it) { return it.item_params && it.item_params.cid; });
            if (cids.length) return cids;
        }
    }
    return [];
}

function parseTag(p) {
    let t = {};
    try { t = JSON.parse(p.uni_imgtag || p.imgtag || "{}") || {}; } catch (e) {}
    return t;
}

async function getFilterData(cid) {
    const b = JSON.parse(JSON.stringify(DBODY));
    b.page_params.channel_id = cid;
    return postJson(APIHOST + "/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=1000005&vplatform=2&vversion_name=8.9.10&new_mark_label_enabled=1", b);
}

async function home(filter) {
    const cdata = {
        "电视剧": "100113",
        "电影": "100173",
        "综艺": "100109",
        "纪录片": "100105",
        "动漫": "100119",
        "少儿": "100150",
        "短剧": "110755"
    };
    const classes = [], filters = {};
    const jobs = [];
    const ids = [];
    for (const k in cdata) {
        classes.push({ type_name: k, type_id: cdata[k] });
        ids.push(cdata[k]);
        jobs.push(getFilterData(cdata[k]).catch(function () { return null; }));
    }
    const datas = await Promise.all(jobs);
    datas.forEach(function (data, i) {
        const cid = ids[i];
        if (!data || !data.data || !data.data.module_list_datas) return;
        let filterItems = [];
        for (const mld of data.data.module_list_datas) {
            for (const md of (mld.module_datas || [])) {
                const fitems = (md.item_data_lists && md.item_data_lists.item_datas) || [];
                const fkeys = fitems.filter(function (it) { return it.item_params && it.item_params.index_item_key; });
                if (fkeys.length) { filterItems = fkeys; break; }
            }
            if (filterItems.length) break;
        }
        const fd = {};
        for (const item of filterItems) {
            const params = item.item_params;
            if (!params || !params.index_item_key) continue;
            if (!fd[params.index_item_key]) {
                fd[params.index_item_key] = {
                    key: params.index_item_key,
                    name: params.index_name,
                    value: []
                };
            }
            fd[params.index_item_key].value.push({
                n: params.option_name,
                v: params.option_value
            });
        }
        filters[cid] = Object.keys(fd).map(function (k) { return fd[k]; });
    });
    return JSON.stringify({ class: classes, filters: filters });
}

async function homeVod() {
    const list = [];
    // v.qq.com 首页已无 __INITIAL_STATE__, 用电视剧分类第一页数据做推荐
    try {
        const b = JSON.parse(JSON.stringify(DBODY));
        b.page_params.channel_id = "100113";
        const data = await postJson(APIHOST + "/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=1000005&vplatform=2&vversion_name=8.9.10&new_mark_label_enabled=1", b);
        for (const its of pickVideoItems(data)) {
            const id = its.item_params.cid;
            if (!id) continue;
            const p = its.item_params;
            const tag = parseTag(p);
            list.push({
                vod_id: id,
                vod_name: p.mz_title || p.title,
                vod_pic: p.new_pic_hz || p.new_pic_vt,
                vod_year: tag.tag_2 && tag.tag_2.text,
                vod_remarks: tag.tag_4 && tag.tag_4.text
            });
        }
    } catch (e) {}
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    const page = parseInt(pg) || 1;
    const ext = extend || {};
    const params = {
        sort: ext.sort || "75",
        attr: ext.attr || "-1",
        itype: ext.itype || "-1",
        ipay: ext.ipay || "-1",
        iarea: ext.iarea || "-1",
        iyear: ext.iyear || "-1",
        theater: ext.theater || "-1",
        award: ext.award || "-1",
        recommend: ext.recommend || "-1"
    };
    if (page === 1 || !catBody) catBody = JSON.parse(JSON.stringify(DBODY));
    catBody.page_params.channel_id = tid;
    catBody.page_params.filter_params = paramsToStr(params);
    const data = await postJson(APIHOST + "/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=1000005&vplatform=2&vversion_name=8.9.10&new_mark_label_enabled=1", catBody);
    const list = [];
    let pagecount = page;
    if (data && data.data) {
        const ndata = data.data;
        if (ndata.has_next_page) {
            pagecount = 9999;
            catBody.page_context = ndata.next_page_context;
        } else {
            pagecount = page;
        }
        for (const its of pickVideoItems(data)) {
            const id = its.item_params.cid;
            if (!id) continue;
            const p = its.item_params;
            const tag = parseTag(p);
            const name = p.mz_title || p.title;
            const pic = p.new_pic_hz || p.new_pic_vt;
            list.push({
                vod_id: id,
                vod_name: name,
                vod_pic: pic,
                vod_year: tag.tag_2 && tag.tag_2.text,
                vod_remarks: tag.tag_4 && tag.tag_4.text
            });
        }
    }
    return JSON.stringify({ list: list, page: page, pagecount: pagecount, limit: list.length, total: 999999 });
}

async function getVdata(body) {
    try {
        return await postJson(APIHOST + "/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=3000010&vplatform=2&vversion_name=8.2.96", body);
    } catch (e) {
        return { data: { module_list_datas: [] } };
    }
}

async function processTabs(data, body) {
    try {
        const lastMld = data.data.module_list_datas[data.data.module_list_datas.length - 1];
        const lastMd = lastMld.module_datas[lastMld.module_datas.length - 1];
        let pdata = (lastMd.item_data_lists && lastMd.item_data_lists.item_datas) || [];
        let tabs = lastMd.module_params && lastMd.module_params.tabs;
        if (tabs) {
            try { tabs = JSON.parse(tabs); } catch (e) { tabs = null; }
            if (tabs && tabs.length) {
                const tasks = [];
                for (let i = 1; i < tabs.length; i++) {
                    const nb = JSON.parse(JSON.stringify(body));
                    nb.page_params.page_context = tabs[i].page_context;
                    tasks.push(getVdata(nb));
                }
                const results = await Promise.all(tasks);
                for (const result of results) {
                    if (result && result.data && result.data.module_list_datas) {
                        const mld = result.data.module_list_datas[result.data.module_list_datas.length - 1];
                        const md = mld.module_datas[mld.module_datas.length - 1];
                        const pd = (md.item_data_lists && md.item_data_lists.item_datas) || [];
                        pdata = pdata.concat(pd);
                    }
                }
            }
        }
        return pdata;
    } catch (e) {
        return [];
    }
}

function buildVod(vdata, actors, plist, ylist, names) {
    const d = vdata.data.module_list_datas[0].module_datas[0].item_data_lists.item_datas[0].item_params;
    const urls = [];
    if (plist.length) urls.push(plist.join("#"));
    if (ylist.length) urls.push(ylist.join("#"));
    return {
        type_name: d.sub_genre || "",
        vod_name: d.title || "",
        vod_year: d.year || "",
        vod_area: d.area_name || "",
        vod_remarks: d.holly_online_time || d.hotval || "",
        vod_actor: actors.join(","),
        vod_content: "【琉🔹璃❤广告勿信👉剧情】📢" + (d.cover_description || ""),
        vod_play_from: names.join("$$$"),
        vod_play_url: urls.join("$$$")
    };
}

async function detail(ids) {
    const cid = String(Array.isArray(ids) ? ids[0] : ids);
    const vbody = {
        page_params: {
            req_from: "web",
            cid: cid,
            vid: "",
            lid: "",
            page_type: "detail_operation",
            page_id: "detail_page_introduction"
        },
        has_cache: 1
    };
    const body = {
        page_params: {
            req_from: "web_vsite",
            page_id: "vsite_episode_list",
            page_type: "detail_operation",
            id_type: "1",
            page_size: "",
            cid: cid,
            vid: "",
            lid: "",
            page_num: "",
            page_context: "",
            detail_page_type: "1"
        },
        has_cache: 1
    };
    const pair = await Promise.all([getVdata(vbody), getVdata(body)]);
    const vdata = pair[0], data = pair[1];
    const pdata = await processTabs(data, body);
    if (!pdata.length || !vdata || !vdata.data || !vdata.data.module_list_datas) {
        return JSON.stringify({ list: [{ vod_play_from: "哎呀翻车啦", vod_play_url: "翻车啦#555" }] });
    }
    let actors = [];
    try {
        const stars = vdata.data.module_list_datas[0].module_datas[0].item_data_lists.item_datas[0].sub_items.star_list.item_datas || [];
        actors = stars.map(function (s) { return s.item_params.name; });
    } catch (e) {}
    const names = ["腾讯视频", "预告片"];
    const plist = [], ylist = [];
    for (const k of pdata) {
        if (k.item_id) {
            const pid = k.item_params.union_title + "$" + cid + "@" + k.item_id;
            if (String(k.item_params.union_title).indexOf("预告") >= 0) ylist.push(pid);
            else plist.push(pid);
        }
    }
    if (!plist.length) names.splice(names.indexOf("腾讯视频"), 1);
    if (!ylist.length) names.splice(names.indexOf("预告片"), 1);
    return JSON.stringify({ list: [buildVod(vdata, actors, plist, ylist, names)] });
}

async function play(flag, id, flags) {
    const parts = String(id).split("$").pop().split("@");
    const cid = parts[0];
    const vid = parts.length > 1 ? parts[1] : "";
    const coverUrl = HOST + "/x/cover/" + cid + "/" + vid + ".html";
    // 解析链严格顺序: 麒麟→观潮, 全失败交壳嗅探
    for (const api of JX_APIS) {
        try {
            const r = await req(api + encodeURIComponent(coverUrl), { headers: { "User-Agent": UA }, timeout: 8 });
            const j = JSON.parse((r && r.content) || "{}");
            const u = j.url || "";
            if (u && (/\.m3u8/.test(u) || /\.mp4/.test(u))) {
                return JSON.stringify({
                    parse: 0,
                    url: u,
                    header: { "User-Agent": UA, "Referer": coverUrl }
                });
            }
        } catch (e) {}
    }
    return JSON.stringify({
        parse: 1,
        url: coverUrl,
        jx: 1,
        header: { "User-Agent": UA, "Referer": HOST + "/" }
    });
}

async function search(wd, quick, pg) {
    const page = parseInt(pg) || 1;
    const body = {
        version: "24072901", clientType: 1, filterValue: "",
        uuid: "tvbox-" + Date.now() + "-" + Math.floor(Math.random() * 1e6),
        retry: 0, query: wd, pagenum: page - 1, pagesize: 30,
        queryFrom: 0, searchDatakey: "", transInfo: "", isneedQc: true,
        preQid: "", adClientInfo: "",
        extraInfo: { isNewMarkLabel: "1", multi_terminal_pc: "1" }
    };
    const data = await postJson(APIHOST + "/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2", body);
    const list = [];
    if (data && data.data && data.data.areaBoxList && data.data.areaBoxList.length) {
        const items = data.data.areaBoxList[data.data.areaBoxList.length - 1].itemList || [];
        for (const k of items) {
            if (!k.doc || !k.doc.id) continue;
            let tag = {};
            const it = k.videoInfo && k.videoInfo.imgTag;
            if (it && typeof it === "string") {
                try { tag = JSON.parse(it); } catch (e) {}
            }
            list.push({
                vod_id: k.doc.id,
                vod_name: k.videoInfo && k.videoInfo.title,
                vod_pic: k.videoInfo && k.videoInfo.imgUrl,
                vod_year: (tag.tag_2 && tag.tag_2.text) || "",
                vod_remarks: (tag.tag_4 && tag.tag_4.text) || ""
            });
        }
    }
    return JSON.stringify({ list: list, page: page });
}

export default { init, home, homeVod, category, detail, play, search };