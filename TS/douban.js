// 豆瓣 douban —— 由 douban.py 移植为 qjs 单文件
// 纯 frodo.douban.com 接口 + apikey 硬编码；detail/search/player 空实现
const DOUBAN_API = 'https://frodo.douban.com/api/v2';
const API_KEY = '0ac44ae016490db2204ce0a042db2916';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36 MicroMessenger/7.0.9.501 NetType/WIFI MiniProgramEnv/Windows WindowsWechat';
const REFERER = 'https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html';
const PIC_SUFFIX = '@Referer=https://api.douban.com/@User-Agent=Mozilla/5.0%20(Windows%20NT%2010.0;%20Win64;%20x64)%20AppleWebKit/537.36%20(KHTML,%20like%20Gecko)%20Chrome/122.0.0.0%20Safari/537.36';

const GROUPS = {
    hot_gaia: ['movie/hot_gaia', 'items'],
    tv_hot: ['subject_collection/tv_hot/items', 'subject_collection_items'],
    tv_animation: ['subject_collection/tv_animation/items', 'subject_collection_items'],
    anime_hot: ['subject_collection/tv_animation/items', 'subject_collection_items'],
    show_hot: ['subject_collection/show_hot/items', 'subject_collection_items'],
    movie: ['movie/recommend', 'items'],
    tv: ['tv/recommend', 'items'],
    movie_real_time_hotest: ['subject_collection/movie_real_time_hotest/items', 'subject_collection_items'],
    movie_weekly_best: ['subject_collection/movie_weekly_best/items', 'subject_collection_items'],
    movie_top250: ['subject_collection/movie_top250/items', 'subject_collection_items'],
    tv_real_time_hotest: ['subject_collection/tv_real_time_hotest/items', 'subject_collection_items'],
    tv_chinese_best_weekly: ['subject_collection/tv_chinese_best_weekly/items', 'subject_collection_items'],
    tv_global_best_weekly: ['subject_collection/tv_global_best_weekly/items', 'subject_collection_items'],
    show_chinese_best_weekly: ['subject_collection/show_chinese_best_weekly/items', 'subject_collection_items'],
    show_global_best_weekly: ['subject_collection/show_global_best_weekly/items', 'subject_collection_items']
};
const RANK_MAP = {
    rank_list_movie: 'movie_real_time_hotest',
    rank_list_tv: 'tv_real_time_hotest'
};

function todayISO() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
const TODAY = todayISO();

async function apiGet(url) {
    try {
        const r = await req(url, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': REFERER },
            timeout: 5000
        });
        const text = (r && r.content != null) ? String(r.content) : '';
        return text ? JSON.parse(text) : {};
    } catch (e) { return {}; }
}

function isReleased(item) {
    if (item.release_date) return String(item.release_date) <= TODAY;
    if (item.date) return String(item.date) <= TODAY;
    return true;
}

function buildVod(item) {
    const rawType = String(item.type || '').toLowerCase();
    let typeName = '';
    if (rawType.indexOf('movie') >= 0) typeName = '电影';
    else if (rawType.indexOf('tv') >= 0) typeName = '剧集';

    const cardSub = String(item.card_subtitle || '');
    let year = '', region = '';
    const m = cardSub.match(/^(\d{4})\s*\/\s*([^/]+)/);
    if (m) { year = m[1]; region = m[2].trim(); }

    let ratingVal = '暂无';
    const rating = item.rating;
    if (rating && rating.value && Number(rating.value) !== 0) ratingVal = String(rating.value);

    let picUrl = '';
    const pic = item.pic;
    if (pic && pic.normal) picUrl = pic.normal + PIC_SUFFIX;

    return {
        vod_id: String(item.id || ''),
        vod_name: String(item.title || ''),
        vod_pic: picUrl,
        vod_remarks: typeName + '评分 ' + ratingVal,
        vod_year: year ? (year + region) : ''
    };
}

// ---------- filters (硬编码自 douban.py config) ----------
function buildFilters() {
    return {
        hot_gaia: [
            { key: 'sort', name: '排序', value: [
                { n: '热度', v: 'recommend' }, { n: '最新', v: 'time' }, { n: '评分', v: 'rank' }]},
            { key: 'area', name: '地区', value: [
                { n: '全部', v: '全部' }, { n: '华语', v: '华语' }, { n: '欧美', v: '欧美' },
                { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' }]}
        ],
        tv_hot: [
            { key: 'type', name: '分类', value: [
                { n: '综合', v: 'tv_hot' }, { n: '国产剧', v: 'tv_domestic' }, { n: '欧美剧', v: 'tv_american' },
                { n: '日剧', v: 'tv_japanese' }, { n: '韩剧', v: 'tv_korean' }, { n: '动画', v: 'tv_animation' }]}
        ],
        anime_hot: [
            { key: 'type', name: '分类', value: [ { n: '热门动画', v: 'tv_animation' } ] }
        ],
        show_hot: [
            { key: 'type', name: '分类', value: [
                { n: '综合', v: 'show_hot' }, { n: '国内', v: 'show_domestic' }, { n: '国外', v: 'show_foreign' }]}
        ],
        movie: [
            { key: '类型', name: '类型', value: [
                { n: '全部类型', v: '' }, { n: '喜剧', v: '喜剧' }, { n: '爱情', v: '爱情' },
                { n: '动作', v: '动作' }, { n: '科幻', v: '科幻' }, { n: '动画', v: '动画' },
                { n: '悬疑', v: '悬疑' }, { n: '犯罪', v: '犯罪' }, { n: '惊悚', v: '惊悚' },
                { n: '冒险', v: '冒险' }, { n: '音乐', v: '音乐' }, { n: '历史', v: '历史' },
                { n: '奇幻', v: '奇幻' }, { n: '恐怖', v: '恐怖' }, { n: '战争', v: '战争' },
                { n: '传记', v: '传记' }, { n: '歌舞', v: '歌舞' }, { n: '武侠', v: '武侠' },
                { n: '情色', v: '情色' }, { n: '灾难', v: '灾难' }, { n: '西部', v: '西部' },
                { n: '纪录片', v: '纪录片' }, { n: '短片', v: '短片' }]},
            { key: '地区', name: '地区', value: [
                { n: '全部地区', v: '' }, { n: '华语', v: '华语' }, { n: '欧美', v: '欧美' },
                { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' }, { n: '中国大陆', v: '中国大陆' },
                { n: '美国', v: '美国' }, { n: '中国香港', v: '中国香港' }, { n: '中国台湾', v: '中国台湾' },
                { n: '英国', v: '英国' }, { n: '法国', v: '法国' }, { n: '德国', v: '德国' },
                { n: '意大利', v: '意大利' }, { n: '西班牙', v: '西班牙' }, { n: '印度', v: '印度' },
                { n: '泰国', v: '泰国' }, { n: '俄罗斯', v: '俄罗斯' }, { n: '加拿大', v: '加拿大' },
                { n: '澳大利亚', v: '澳大利亚' }, { n: '爱尔兰', v: '爱尔兰' }, { n: '瑞典', v: '瑞典' },
                { n: '巴西', v: '巴西' }, { n: '丹麦', v: '丹麦' }]},
            { key: 'sort', name: '排序', value: [
                { n: '近期热度', v: 'T' }, { n: '首映时间', v: 'R' }, { n: '高分优先', v: 'S' }]},
            { key: '年代', name: '年代', value: [
                { n: '全部年代', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' },
                { n: '2024', v: '2024' }, { n: '2023', v: '2023' }, { n: '2022', v: '2022' },
                { n: '2021', v: '2021' }, { n: '2020', v: '2020' }, { n: '2019', v: '2019' },
                { n: '2010年代', v: '2010年代' }, { n: '2000年代', v: '2000年代' }, { n: '90年代', v: '90年代' },
                { n: '80年代', v: '80年代' }, { n: '70年代', v: '70年代' }, { n: '60年代', v: '60年代' },
                { n: '更早', v: '更早' }]}
        ],
        tv: [
            { key: '类型', name: '类型', value: [
                { n: '不限', v: '' }, { n: '电视剧', v: '电视剧' }, { n: '综艺', v: '综艺' }]},
            { key: '电视剧形式', name: '电视剧形式', value: [
                { n: '不限', v: '' }, { n: '喜剧', v: '喜剧' }, { n: '爱情', v: '爱情' },
                { n: '悬疑', v: '悬疑' }, { n: '动画', v: '动画' }, { n: '武侠', v: '武侠' },
                { n: '古装', v: '古装' }, { n: '家庭', v: '家庭' }, { n: '犯罪', v: '犯罪' },
                { n: '科幻', v: '科幻' }, { n: '恐怖', v: '恐怖' }, { n: '历史', v: '历史' },
                { n: '战争', v: '战争' }, { n: '动作', v: '动作' }, { n: '冒险', v: '冒险' },
                { n: '传记', v: '传记' }, { n: '剧情', v: '剧情' }, { n: '奇幻', v: '奇幻' },
                { n: '惊悚', v: '惊悚' }, { n: '灾难', v: '灾难' }, { n: '歌舞', v: '歌舞' },
                { n: '音乐', v: '音乐' }]},
            { key: '综艺形式', name: '综艺形式', value: [
                { n: '不限', v: '' }, { n: '真人秀', v: '真人秀' }, { n: '脱口秀', v: '脱口秀' },
                { n: '音乐', v: '音乐' }, { n: '歌舞', v: '歌舞' }]},
            { key: '地区', name: '地区', value: [
                { n: '全部地区', v: '' }, { n: '华语', v: '华语' }, { n: '欧美', v: '欧美' },
                { n: '国外', v: '国外' }, { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' },
                { n: '中国大陆', v: '中国大陆' }, { n: '中国香港', v: '中国香港' }, { n: '美国', v: '美国' },
                { n: '英国', v: '英国' }, { n: '泰国', v: '泰国' }, { n: '中国台湾', v: '中国台湾' },
                { n: '意大利', v: '意大利' }, { n: '法国', v: '法国' }, { n: '德国', v: '德国' },
                { n: '西班牙', v: '西班牙' }, { n: '俄罗斯', v: '俄罗斯' }, { n: '瑞典', v: '瑞典' },
                { n: '巴西', v: '巴西' }, { n: '丹麦', v: '丹麦' }, { n: '印度', v: '印度' },
                { n: '加拿大', v: '加拿大' }, { n: '爱尔兰', v: '爱尔兰' }, { n: '澳大利亚', v: '澳大利亚' }]},
            { key: 'sort', name: '排序', value: [
                { n: '近期热度', v: 'T' }, { n: '首播时间', v: 'R' }, { n: '高分优先', v: 'S' }]},
            { key: '年代', name: '年代', value: [
                { n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' },
                { n: '2024', v: '2024' }, { n: '2023', v: '2023' }, { n: '2022', v: '2022' },
                { n: '2021', v: '2021' }, { n: '2020', v: '2020' }, { n: '2019', v: '2019' },
                { n: '2010年代', v: '2010年代' }, { n: '2000年代', v: '2000年代' }, { n: '90年代', v: '90年代' },
                { n: '80年代', v: '80年代' }, { n: '70年代', v: '70年代' }, { n: '60年代', v: '60年代' },
                { n: '更早', v: '更早' }]},
            { key: '平台', name: '平台', value: [
                { n: '全部', v: '' }, { n: '腾讯视频', v: '腾讯视频' }, { n: '爱奇艺', v: '爱奇艺' },
                { n: '优酷', v: '优酷' }, { n: '湖南卫视', v: '湖南卫视' }, { n: 'Netflix', v: 'Netflix' },
                { n: 'HBO', v: 'HBO' }, { n: 'BBC', v: 'BBC' }, { n: 'NHK', v: 'NHK' },
                { n: 'CBS', v: 'CBS' }, { n: 'NBC', v: 'NBC' }, { n: 'tvN', v: 'tvN' }]}
        ],
        rank_list_movie: [
            { key: '榜单', name: '榜单', value: [
                { n: '实时热门电影', v: 'movie_real_time_hotest' },
                { n: '一周口碑电影榜', v: 'movie_weekly_best' },
                { n: '豆瓣电影Top250', v: 'movie_top250' }]}
        ],
        rank_list_tv: [
            { key: '榜单', name: '榜单', value: [
                { n: '实时热门电视', v: 'tv_real_time_hotest' },
                { n: '华语口碑剧集榜', v: 'tv_chinese_best_weekly' },
                { n: '全球口碑剧集榜', v: 'tv_global_best_weekly' },
                { n: '国内口碑综艺榜', v: 'show_chinese_best_weekly' },
                { n: '国外口碑综艺榜', v: 'show_global_best_weekly' }]}
        ]
    };
}

async function init(cfg) {}

async function home(filter) {
    const cateManual = {
        ,
        '魔盒推荐Top250': 'movie_top250''热门电影': 'hot_gaia', '热播剧集': 'tv_hot', '热门动漫': 'tv_animation',
        '热播综艺': 'show_hot', '电影筛选': 'movie', '电视筛选': 'tv',
        '电影榜单': 'rank_list_movie', '电视剧榜单': 'rank_list_tv'
    };
    const classes = [];
    for (const k in cateManual) classes.push({ type_name: k, type_id: cateManual[k] });
    const result = { class: classes };
    if (filter) result.filters = buildFilters();
    return JSON.stringify(result);
}

async function homeVod() {
    try {
        const url = DOUBAN_API + '/subject_collection/subject_real_time_hotest/items?apikey=' + API_KEY + '&has_schedule=true&count=30';
        const jo = await apiGet(url);
        const key = 'subject_collection_items';
        const items = (jo && jo[key]) || [];
        const list = [];
        for (const item of items) {
            if (item.type !== 'movie' && item.type !== 'tv') continue;
            if (!isReleased(item)) continue;
            const vod = buildVod(item);
            if (vod.vod_pic) list.push(vod);
        }
        return JSON.stringify({ list: list });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

async function category(tid, pg, filter, extend) {
    let ext = extend || {};
    if (typeof ext === 'string' && ext) { try { ext = JSON.parse(ext); } catch (e) { ext = {}; } }
    const page = parseInt(pg || 1, 10) || 1;
    const start = (page - 1) * 20;

    let rankMap = RANK_MAP;
    let realTid = tid;
    if (rankMap[tid]) {
        realTid = ext['榜单'] || rankMap[tid];
    }
    let path, dataKey;
    if (GROUPS[realTid]) { [path, dataKey] = GROUPS[realTid]; }
    else { [path, dataKey] = GROUPS.movie; }

    let url = DOUBAN_API + '/' + path + '?apikey=' + API_KEY + '&start=' + start + '&count=20';
    const sort = ext.sort || 'T';
    const tags = Object.keys(ext).filter(k => k !== 'sort' && String(ext[k]).trim()).map(k => String(ext[k])).join(',');

    if (realTid === 'movie' || realTid === 'tv') {
        url = DOUBAN_API + '/' + path + '?apikey=' + API_KEY + '&sort=' + encodeURIComponent(sort) + '&tags=' + encodeURIComponent(tags) + '&start=' + start + '&count=20';
    } else if (realTid === 'hot_gaia') {
        const s = ext.sort || 'recommend';
        const area = ext.area || '全部';
        url = DOUBAN_API + '/' + path + '?apikey=' + API_KEY + '&sort=' + encodeURIComponent(s) + '&area=' + encodeURIComponent(area) + '&start=' + start + '&count=20';
    }

    const jo = await apiGet(url);
    const items = (jo && jo[dataKey]) || [];
    const videos = [];
    for (const item of items) {
        if (!isReleased(item)) continue;
        const vod = buildVod(item);
        if (vod.vod_pic) videos.push(vod);
    }
    return JSON.stringify({ list: videos, page: page, pagecount: 9999, limit: 20, total: 999999 });
}

async function search(wd, quick, pg) {
    return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 0, total: 0 });
}

async function detail(id) {
    return JSON.stringify({ list: [] });
}

async function play(flag, id, vipFlags) {
    return JSON.stringify({ parse: 0, url: '', header: {} });
}

export default { init, home, homeVod, category, detail, search, play };