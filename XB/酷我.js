let siteName = '酷我音乐',
    siteKey = '',
    siteType = 0;
let host = 'http://wapi.kuwo.cn';

function init(cfg) {
    siteName = cfg.skey?.split('_')[1] || cfg.skey || '酷我音乐';
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

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function hd(img) {
    if (!img) return '';
    return img.replace('/120/', '/4000/').replace('/500/', '/2160/').replace('/150/', '/1000/').replace('/300/', '/1500/');
}

function generateFilters() {
    return {
        "bang": [],
        "artist": [{
            key: "category",
            name: "类别",
            value: [{"n":"全部","v":"0"},{"n":"华语男","v":"1"},{"n":"华语女","v":"2"},{"n":"华语组合","v":"3"},{"n":"日韩男","v":"4"},{"n":"日韩女","v":"5"},{"n":"日韩组合","v":"6"},{"n":"欧美男","v":"7"},{"n":"欧美女","v":"8"},{"n":"欧美组合","v":"9"},{"n":"其他","v":"10"}]
        }, {
            key: "prefix",
            name: "首字母",
            value: [{"n":"全部","v":""},{"n":"A","v":"A"},{"n":"B","v":"B"},{"n":"C","v":"C"},{"n":"D","v":"D"},{"n":"E","v":"E"},{"n":"F","v":"F"},{"n":"G","v":"G"},{"n":"H","v":"H"},{"n":"I","v":"I"},{"n":"J","v":"J"},{"n":"K","v":"K"},{"n":"L","v":"L"},{"n":"M","v":"M"},{"n":"N","v":"N"},{"n":"O","v":"O"},{"n":"P","v":"P"},{"n":"Q","v":"Q"},{"n":"R","v":"R"},{"n":"S","v":"S"},{"n":"T","v":"T"},{"n":"U","v":"U"},{"n":"V","v":"V"},{"n":"W","v":"W"},{"n":"X","v":"X"},{"n":"Y","v":"Y"},{"n":"Z","v":"Z"}]
        }],
        "playlist": [{
            key: "tag",
            name: "标签",
            value: [{"n":"全部","v":"0"},{"n":"最新","v":"new"},{"n":"最热","v":"hot"},{"n":"短视频","v":"2189"},{"n":"经典","v":"1265"},{"n":"情歌","v":"2200"},{"n":"BGM","v":"2199"},{"n":"演唱会","v":"2212"},{"n":"游戏","v":"1877"},{"n":"怀旧","v":"155"},{"n":"合唱","v":"2201"},{"n":"网络","v":"621"},{"n":"儿童","v":"171"},{"n":"ACG","v":"181"},{"n":"影视","v":"180"},{"n":"网红","v":"1879"},{"n":"春节","v":"2190"},{"n":"翻唱","v":"1848"},{"n":"伤感","v":"146"},{"n":"解压","v":"62"},{"n":"励志","v":"58"},{"n":"开心","v":"143"},{"n":"甜蜜","v":"137"},{"n":"兴奋","v":"139"},{"n":"安静","v":"67"},{"n":"思念","v":"160"},{"n":"开车","v":"376"},{"n":"运动","v":"366"},{"n":"睡眠","v":"354"},{"n":"跳舞","v":"378"},{"n":"学习","v":"1876"},{"n":"清晨","v":"353"},{"n":"KTV","v":"361"},{"n":"店铺专用","v":"263"},{"n":"校园","v":"382"},{"n":"旅行","v":"375"},{"n":"工作","v":"386"},{"n":"广场舞","v":"334"},{"n":"通勤","v":"2202"},{"n":"宅家","v":"2203"},{"n":"Citywalk","v":"2214"},{"n":"露营","v":"2213"},{"n":"70后","v":"637"},{"n":"80后","v":"638"},{"n":"90后","v":"639"},{"n":"00后","v":"640"},{"n":"流行","v":"393"},{"n":"DJ","v":"168"},{"n":"古风","v":"127"},{"n":"佛乐","v":"220"},{"n":"轻音乐","v":"173"},{"n":"纯音乐","v":"577"},{"n":"电子","v":"391"},{"n":"喊麦","v":"216"},{"n":"3D","v":"1366"},{"n":"器乐","v":"578"},{"n":"摇滚","v":"389"},{"n":"民歌","v":"1921"},{"n":"民谣","v":"392"},{"n":"古典","v":"390"},{"n":"嘻哈","v":"387"},{"n":"乡村","v":"399"},{"n":"爵士","v":"397"},{"n":"R&B","v":"394"},{"n":"华语","v":"37"},{"n":"欧美","v":"35"},{"n":"韩语","v":"1093"},{"n":"粤语","v":"13"},{"n":"日语","v":"1091"},{"n":"小语种","v":"12"}]
        }]
    };
}

async function getLyric(rid) {
    const maxRetries = 20;
    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
            let url = `https://kuwo.cn/openapi/v1/www/lyric/getlyric?musicId=${rid}`;
            let html = await request(url);
            if (html) {
                let json = safeJSONParse(html);
                if (json.code === 200 && json.data && json.data.lrclist && json.data.lrclist.length > 0) {
                    let lrclist = json.data.lrclist;
                    let lyric = lrclist.map(item => {
                        let time = parseFloat(item.time) || 0;
                        let min = Math.floor(time / 60).toString().padStart(2, '0');
                        let sec = Math.floor(time % 60).toString().padStart(2, '0');
                        let ms = Math.floor((time % 1) * 100).toString().padStart(2, '0');
                        return `[${min}:${sec}.${ms}]${item.lineLyric || ''}`;
                    }).join('\n');
                    return lyric;
                }
            }
        } catch (e) {}
        if (retryCount < maxRetries - 1) await sleep(0.01);
    }
    return '暂无歌词';
}

async function getUrl(rid, br) {
    let url = `https://nmobi.kuwo.cn/mobi.s?f=web&user=0&source=kwplayer_ar_4.4.2.7_B_nuoweida_vh.apk&type=convert_url_with_sign&rid=${rid}&format=mp3&br=${br}`;
    let html = await request(url);
    if (html) {
        let j = safeJSONParse(html);
        let u = (j.data && j.data.url || '').trim();
        // 直链参数用$分隔，壳会把$当集名分隔符截断，必须换成&
        return u.replace(/\$/g, '&');
    }
    return '';
}

async function getAntiUrl(rid) {
    let u = await request(`https://antiserver.kuwo.cn/anti.s?type=convert_url&rid=MUSIC_${rid}&format=aac|mp3&response=url`);
    if (u && typeof u === 'string' && u.trim().startsWith('http')) return u.trim();
    return '';
}

function home(filter) {
    return JSON.stringify({
        class: [{
            type_id: 'bang',
            type_name: '排行榜'
        }, {
            type_id: 'artist',
            type_name: '歌手'
        }, {
            type_id: 'playlist',
            type_name: '歌单'
        }],
        filters: generateFilters()
    });
}

async function homeVod() {
    let url = `${host}/api/pc/classify/playlist/getRcmPlayList?pn=1&rn=30&order=hot`;
    let html = await request(url);
    let res = safeJSONParse(html);
    let data = res.data?.data || [];
    let videos = data.map(it => ({
        vod_id: 'pl$' + (it.id || '') + '$' + (it.name || ''),
        vod_name: it.name || '未命名歌单',
        vod_pic: hd(it.img),
        vod_remarks: '🎧' + (it.listencnt || it.favorcnt || '0')
    }));
    return JSON.stringify({
        list: videos
    });
}

async function category(tid, pg, filter, extend) {
    if (pg <= 0 || typeof pg == 'undefined') pg = 1;

    if (tid === 'bang') {
        let html = await request(`${host}/api/pc/bang/list`);
        let res = safeJSONParse(html);
        let videos = [];
        let seen = new Set();
        let walk = (node) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) {
                node.forEach(walk);
                return;
            }
            let sid = (node.sourceid || '').toString();
            if (/^\d+$/.test(sid) && !seen.has(sid)) {
                seen.add(sid);
                videos.push({
                    vod_id: 'bang$' + sid + '$' + (node.name || node.disname || ''),
                    vod_name: node.name || node.disname || '榜单',
                    vod_pic: hd(node.pic || ''),
                    vod_remarks: node.pubTime ? node.pubTime + ' 更新' : ''
                });
            }
            Object.keys(node).forEach(k => walk(node[k]));
        };
        walk(res);
        return JSON.stringify({
            page: 1,
            pagecount: 1,
            limit: videos.length,
            total: videos.length,
            list: videos
        });
    }

    if (tid === 'artist') {
        let prefix = extend?.prefix || '';
        let toVideo = (it, base) => ({
            vod_id: 'artist$' + (it.ARTISTID || it.DC_TARGETID || '') + '$' + (it.ARTIST || ''),
            vod_name: it.ARTIST || '未知歌手',
            vod_pic: it.hts_PICPATH || (it.PICPATH ? base + it.PICPATH : ''),
            vod_remarks: (it.SONGNUM || '0') + '首歌'
        });
        if (!prefix) {
            // 「全部」无免鉴权热门接口：内置热门名单，并发查搜索接口取真实ID/头像
            const hotNames = ['周杰伦', '林俊杰', '陈奕迅', 'G.E.M.邓紫棋', 'BEYOND', '张国荣', '王杰', '周传雄', '张学友', '刘德华',
                '薛之谦', '李荣浩', '张杰', '华晨宇', '毛不易', '周深', '许嵩', '汪苏泷', '凤凰传奇', '刀郎',
                '王菲', '那英', '蔡依林', '五月天', 'S.H.E', '萧敬腾', '张信哲', '任贤齐', '伍佰', '朴树',
                '许巍', '汪峰', '韩红', '林忆莲', '张惠妹', '莫文蔚', '刘若英', '梁静茹', '孙燕姿', '王力宏',
                '陶喆', '胡彦斌', '李克勤', '谭咏麟', '陈慧娴', '梅艳芳', '邓丽君', '罗大佑'];
            // 分批并发，防止一次性48个请求触发限流
            let videos = [];
            const batchSize = 8;
            for (let i = 0; i < hotNames.length; i += batchSize) {
                let batch = hotNames.slice(i, i + batchSize);
                let results = await Promise.all(batch.map(n =>
                    request(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(n)}&pn=0&rn=5&vipver=1&ft=artist&encoding=utf8&rformat=json&mobi=1`)
                ));
                results.forEach((h, j) => {
                    let json = safeJSONParse(h || '{}');
                    let base = json.BASEPICPATH || 'http://img1.kuwo.cn/star/starheads/';
                    let hit = (json.abslist || []).find(it => (it.ARTIST || '') === batch[j])
                        || (json.abslist || [])[0];
                    if (hit && hit.PICPATH) {
                        videos.push(toVideo(hit, base));
                    }
                });
            }
            return JSON.stringify({
                page: 1,
                pagecount: 1,
                limit: videos.length,
                total: videos.length,
                list: videos
            });
        }
        let url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(prefix)}&pn=${pg - 1}&rn=30&vipver=1&ft=artist&encoding=utf8&rformat=json&mobi=1`;
        let html = await request(url);
        let json = safeJSONParse(html || '{}');
        let base = json.BASEPICPATH || 'http://img1.kuwo.cn/star/starheads/';
        let videos = (json.abslist || []).map(it => toVideo(it, base));
        let total = parseInt(json.TOTAL || 0);
        return JSON.stringify({
            page: parseInt(pg),
            pagecount: Math.ceil(total / 30) || 1,
            limit: 30,
            total: total,
            list: videos
        });
    }

    // playlist
    let tag = extend?.tag || '0';
    let url;
    if (tag === '0' || tag === 'hot' || tag === 'new') {
        let order = tag === 'new' ? 'new' : 'hot';
        url = `${host}/api/pc/classify/playlist/getRcmPlayList?pn=${pg}&rn=30&order=${order}`;
    } else {
        url = `${host}/api/pc/classify/playlist/getTagPlayList?pn=${pg}&rn=30&id=${tag}`;
    }
    let html = await request(url);
    let res = safeJSONParse(html);
    let data = res.data?.data || [];
    let total = parseInt(res.data?.total || 0);
    let videos = data.map(it => ({
        vod_id: 'pl$' + (it.id || '') + '$' + (it.name || ''),
        vod_name: it.name || '未命名歌单',
        vod_pic: hd(it.img),
        vod_remarks: '🎧' + (it.listencnt || it.favorcnt || '0')
    }));
    return JSON.stringify({
        page: parseInt(pg),
        pagecount: Math.ceil(total / 30) || 1,
        limit: 30,
        total: total,
        list: videos
    });
}

async function fetchSongs(baseUrl, firstHtml, getList, getTotal, maxPages) {
    let json = safeJSONParse(firstHtml);
    let data = json.data || {};
    let songs = getList(data);
    let total = getTotal(data);
    let pages = Math.min(Math.ceil(total / 30), maxPages);
    if (pages > 1) {
        let tasks = [];
        for (let p = 2; p <= pages; p++) {
            tasks.push(request(baseUrl + p));
        }
        let results = await Promise.all(tasks);
        results.forEach(r => {
            let d = safeJSONParse(r).data || {};
            songs = songs.concat(getList(d));
        });
    }
    return {
        songs,
        data
    };
}

async function detail(id) {
    let input = id.toString();
    let parts = input.split('$');
    let kind = parts[0];

    // 单曲直通（搜索来的）
    if (kind !== 'bang' && kind !== 'artist' && kind !== 'pl') {
        return JSON.stringify({
            list: [{
                vod_id: parts[1],
                vod_name: parts[0],
                vod_pic: hd(parts[2] || ''),
                vod_play_from: '酷我音乐',
                vod_play_url: parts[0] + '$' + parts[1],
                vod_play_pic: hd(parts[2] || ''),
                vod_play_pic_ratio: 1.0
            }]
        });
    }

    let songs = [];
    let name = parts[2] || '';
    let pic = '';
    let content = '';

    if (kind === 'bang') {
        let bid = parts[1];
        let baseUrl = `${host}/api/www/bang/bang/musicList?bangId=${bid}&rn=30&httpsStatus=1&pn=`;
        let r = await fetchSongs(baseUrl, await request(baseUrl + '1'),
            d => d.musicList || [],
            d => parseInt(d.num || 0), 5);
        songs = r.songs;
        pic = r.data.img || '';
        name = name || '酷我榜单';
    } else if (kind === 'artist') {
        let aid = parts[1];
        let baseUrl = `${host}/api/www/artist/artistMusic?artistid=${aid}&rn=30&httpsStatus=1&pn=`;
        let r = await fetchSongs(baseUrl, await request(baseUrl + '1'),
            d => d.list || [],
            d => parseInt(d.total || 0), 5);
        songs = r.songs;
        name = name || (songs[0] && songs[0].artist) || '歌手';
    } else {
        let pid = parts[1];
        let baseUrl = `${host}/api/www/playlist/playListInfo?pid=${pid}&rn=30&httpsStatus=1&pn=`;
        let r = await fetchSongs(baseUrl, await request(baseUrl + '1'),
            d => d.musicList || d.musiclist || [],
            d => parseInt(d.total || 0), 5);
        songs = r.songs;
        name = name || r.data.name || '酷我歌单';
        pic = r.data.img || r.data.img500 || '';
        content = r.data.info || '';
    }

    let playArr = [];
    let songPicArr = [];
    songs.forEach(it => {
        let rid = (it.rid || it.musicrid || '').toString().replace('MUSIC_', '');
        let song = (it.name || it.songname || '').replace(/&nbsp;/g, ' ');
        let artist = (it.artist || '').replace(/&nbsp;/g, ' ');
        let albumpic = hd(it.albumpic || it.pic);
        let displayName = artist ? `${song} [${artist}]` : song;
        if (rid && song) {
            playArr.push(`${displayName}$${rid}&&${albumpic}&&${albumpic}`);
            songPicArr.push(albumpic);
        }
    });

    const vod = {
        vod_id: input,
        vod_name: name,
        vod_pic: hd(pic),
        vod_content: content,
        vod_remarks: songs.length + '首',
        vod_play_from: siteName,
        vod_play_url: playArr.join('#'),
        vod_play_pic: songPicArr.join('#'),
        vod_play_pic_ratio: 1.0
    };

    return JSON.stringify({
        list: [vod]
    });
}

async function play(flag, id, flags) {
    let parts = id.split('&&');
    let firstPart = parts[0] || '';
    let firstParts = firstPart.split('$');
    let songId = firstParts.length > 1 ? firstParts[1] : firstParts[0];
    let albumPic = hd(parts[1]);

    if (/\.(m3u8|mp4|m4a|mp3|aac|flac|ogg|mgg)(\?|$)/i.test(songId)) {
        let cleanUrl = songId.split('?')[0];
        return JSON.stringify({
            parse: 0,
            url: cleanUrl,
            pic: albumPic,
            cover: albumPic,
            lrc: '',
            height: 720
        });
    }

    const qualities = [{
        name: 'HQ高品质',
        br: '320k'
    }, {
        name: '标准品质',
        br: '192k'
    }, {
        name: '流畅音质',
        br: '128k'
    }];
    let urls = [];
    let seenUrls = new Set();

    for (let q of qualities) {
        let url = await getUrl(songId, q.br);
        if (url && !url.includes('.mgg')) {
            let cleanUrl = url.split('?')[0];
            if (!seenUrls.has(cleanUrl)) {
                seenUrls.add(cleanUrl);
                urls.push(q.name, url);
            }
        }
    }

    if (urls.length === 0) {
        let anti = await getAntiUrl(songId);
        if (anti) urls.push('流畅音质', anti);
    }

    let lrcPromise = getLyric(songId);
    let picUrl = albumPic;
    if (!picUrl) {
        try {
            let picRes = await request(`http://artistpicserver.kuwo.cn/pic.web?type=rid_pic&pictype=url&size=500&rid=${songId}`);
            picUrl = picRes.trim().replace('/500/', '/2160/');
        } catch (e) {}
    }

    let result = {
        parse: 0,
        url: urls,
        header: {
            'User-Agent': 'Mozilla/5.0'
        },
        pic: picUrl,
        cover: picUrl,
        height: 720
    };
    let lrc = await lrcPromise;
    if (lrc && lrc !== '暂无歌词') result.lrc = lrc;
    return JSON.stringify(result);
}

async function search(wd, quick, pg) {
    if (pg <= 0 || typeof pg == 'undefined') pg = 1;
    let searchUrl = `https://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(wd)}&pn=${(pg - 1) * 30}&rn=30&vipver=1&ft=music&encoding=utf8&rformat=json&mobi=1`;
    let html = '';
    while (!html) {
        html = await request(searchUrl);
        if (!html) await sleep(0.1);
    }
    let json = safeJSONParse(html || '{}');
    let videos = [];
    if (json.abslist) {
        json.abslist.forEach(it => {
            let rid = it.DC_TARGETID || it.MUSICRID?.replace('MUSIC_', '') || '';
            let pic = it.web_albumpic_short ? `http://img1.kuwo.cn/star/albumcover/${it.web_albumpic_short}` : (it.hts_MVPIC || '');
            videos.push({
                vod_id: `${it.SONGNAME} - ${it.ARTIST}$${rid}$${pic}`,
                vod_name: `${it.SONGNAME} - ${it.ARTIST}`,
                vod_pic: hd(pic),
                vod_remarks: it.ALBUM || '酷我音乐'
            });
        });
    }
    return JSON.stringify({
        page: parseInt(pg),
        pagecount: 999,
        limit: 30,
        total: 999,
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