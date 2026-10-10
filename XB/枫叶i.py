let siteName = '酷狗MV',
    siteKey = '',
    siteType = 0;
let host = 'https://www.kugou.com';
let apiKey = 'e7e165ab27316db14467c07e00f3820d';
let apiBase = 'https://api.linhun.vip/api/kgmv';

function init(cfg) {
    siteName = cfg.skey?.split('_')[1] || cfg.skey || '酷狗MV';
    siteKey = cfg.skey;
    siteType = cfg.stype;
}

function safeJSONParse(str, defaultValue = {}) {
    if (!str || typeof str === 'object') return str || defaultValue;
    try {
        return JSON.parse(str);
    } catch {
        return defaultValue;
    }
}

async function request(url, options = {}) {
    const reqHeaders = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        ...options.headers
    };
    let postType = reqHeaders['Content-Type']?.includes('json') ? 'json' :
        reqHeaders['Content-Type']?.includes('form') ? 'form' : '';

    try {
        const response = await req(url, {
            method: options.method || 'GET',
            headers: reqHeaders,
            data: options.data,
            postType: postType,
            timeout: options.timeout || 15000
        });
        return response?.content || response?.data || response;
    } catch {
        return null;
    }
}

function parseList(html) {
    let videos = [];
    if (!html) return videos;
    let listMatch = html.match(/class="mvlist"[\s\S]*?<\/ul>/);
    let scope = listMatch ? listMatch[0] : html;
    let items = scope.match(/<li[\s\S]*?<\/li>/g) || [];
    items.forEach(it => {
        let hrefM = it.match(/href="([^"]+)"/);
        let titleM = it.match(/title="([^"]+)"/);
        let imgM = it.match(/_src="([^"]+)"/) || it.match(/data-original="([^"]+)"/);
        if (hrefM && titleM) {
            let url = hrefM[1];
            if (!/^https?:/.test(url)) url = host + url;
            let pic = imgM ? imgM[1] : '';
            if (pic.startsWith('//')) pic = 'https:' + pic;
            videos.push({
                vod_id: url,
                vod_name: titleM[1].trim(),
                vod_pic: pic,
                vod_remarks: ''
            });
        }
    });
    return videos;
}

async function home(filter) {
    let classes = [];
    let html = await request(host + '/mvweb/html/');
    if (html) {
        let box = html.match(/id="radioList"[\s\S]*?<\/dl>/) || html.match(/id="radioList"[\s\S]*?<\/div>/);
        let scope = box ? box[0] : html;
        let re = /<a[^>]+href="[^"]*index_(\d+)_1\.html"[^>]*>([^<]+)<\/a>/g;
        let seen = new Set();
        let m;
        while ((m = re.exec(scope)) !== null) {
            if (!seen.has(m[1])) {
                seen.add(m[1]);
                classes.push({
                    type_id: m[1],
                    type_name: m[2].trim()
                });
            }
        }
    }
    return JSON.stringify({
        class: classes
    });
}

async function homeVod() {
    let html = await request(host + '/mvweb/html/');
    let videos = parseList(html);
    return JSON.stringify({
        list: videos
    });
}

async function category(tid, pg, filter, extend) {
    if (pg <= 0 || typeof pg == 'undefined') pg = 1;
    let url = `${host}/mvweb/html/index_${tid}_${pg}.html`;
    let html = await request(url);
    let videos = parseList(html);
    return JSON.stringify({
        page: parseInt(pg),
        pagecount: 999,
        limit: 20,
        total: 999,
        list: videos
    });
}

async function detail(id) {
    let input = id.toString();

    if (input.indexOf('$') > -1) {
        let s = input.split('$');
        return JSON.stringify({
            list: [{
                vod_id: s[1],
                vod_name: s[0],
                vod_pic: s[2] || '',
                vod_play_from: '酷狗MV',
                vod_play_url: s[0] + '$' + s[1]
            }]
        });
    }

    let name = '酷狗MV';
    let pic = '';
    let html = await request(input);
    if (html) {
        let nameM = html.match(/mv_name\s*=\s*"([^"]*)"/);
        if (nameM) name = nameM[1];
        let picM = html.match(/property="og:image"\s+content="([^"]+)"/) || html.match(/mv_img\s*=\s*"([^"]+)"/);
        if (picM) pic = picM[1];
    }
    return JSON.stringify({
        list: [{
            vod_id: input,
            vod_name: name,
            vod_pic: pic,
            vod_play_from: '酷狗MV',
            vod_play_url: name + '$' + input
        }]
    });
}

async function play(flag, id, flags) {
    let parts = id.split('$');
    let url = parts.length > 1 ? parts[1] : parts[0];

    if (!/\.(mp4|m3u8)(\?|$)/i.test(url)) {
        let videoUrl = '';
        let html = await request(url);
        if (html) {
            // 优先从播放页提取直链
            let m = html.match(/mv_url\s*=\s*"([^"]+)"/) || html.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/);
            if (m) videoUrl = m[1];
            // 回退：调用解析API
            if (!videoUrl) {
                let nameM = html.match(/mv_name\s*=\s*"([^"]*)"/);
                if (nameM) {
                    let res = safeJSONParse(await request(`${apiBase}?apiKey=${apiKey}&name=${encodeURIComponent(nameM[1])}&n=1`));
                    if (res.video) videoUrl = res.video;
                }
            }
        }
        if (videoUrl) url = videoUrl;
    }

    // 仍非直链则交回壳嗅探
    if (!/\.(mp4|m3u8)(\?|$)/i.test(url)) {
        return JSON.stringify({
            parse: 1,
            url: url,
            header: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            }
        });
    }
    return JSON.stringify({
        parse: 0,
        url: url,
        header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        }
    });
}

async function search(wd, quick, pg) {
    let videos = [];
    let first = safeJSONParse(await request(`${apiBase}?apiKey=${apiKey}&name=${encodeURIComponent(wd)}&n=`));
    let total = parseInt(first.sun || 0);
    let maxFetch = Math.min(total, 20);
    if (maxFetch > 0) {
        let tasks = [];
        for (let j = 1; j <= maxFetch; j++) {
            tasks.push(request(`${apiBase}?apiKey=${apiKey}&name=${encodeURIComponent(wd)}&n=${j}`));
        }
        let results = await Promise.all(tasks);
        results.forEach(r => {
            let t = safeJSONParse(r);
            if (t.video) {
                videos.push({
                    vod_id: `${t.name || ''} [${t.author || ''}]$${t.video}$${t.img || ''}`,
                    vod_name: t.name || '未知MV',
                    vod_pic: t.img || '',
                    vod_remarks: t.author || ''
                });
            }
        });
    }
    return JSON.stringify({
        page: 1,
        pagecount: 1,
        limit: 20,
        total: videos.length,
        list: videos
    });
}

export function __jsEvalReturn() {
    return {
        init,
        home,
        homeVod,
        category,
        detail,
        play,
        search
    };
}
