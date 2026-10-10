# coding=utf-8
#!/usr/bin/python

from urllib.parse import quote, unquote
from base.spider import Spider
from bs4 import BeautifulSoup
import requests
import base64
import json
import sys
import re

sys.path.append('..')

xurl = "https://www.freeokk.pro"

headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Mobile Safari/537.36'
}

def js_unescape(s):
    s = re.sub(r'%u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)
    return unquote(s)

def build_filters():
    years = [{"n": "全部", "v": ""}] + [{"n": str(y), "v": str(y)} for y in range(2026, 1999, -1)]
    letters = [{"n": "字母", "v": ""}] + [{"n": c, "v": c} for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
    areas = [{"n": "全部", "v": ""}] + [{"n": x, "v": x} for x in
              ["内地","香港","台湾","美国","法国","英国","日本","韩国","德国","泰国","印度","意大利","西班牙","加拿大","其他"]]
    bys = [{"n": "时间", "v": "time"}, {"n": "人气", "v": "hits"}, {"n": "评分", "v": "score"}]
    movie_cls = [{"n": "全部", "v": ""}] + [{"n": x, "v": x} for x in
                ["喜剧","同性","爱情","恐怖","动作","科幻","剧情","战争","犯罪","奇幻","冒险","悬疑","惊悚","古装"]]
    tv_cls = movie_cls + [{"n": "偶像", "v": "偶像"}, {"n": "言情", "v": "言情"}]
    show_cls = [{"n": "全部", "v": ""}] + [{"n": x, "v": x} for x in
                 ["选秀","脱口秀","情感","访谈","播报","旅游","音乐","美食","纪实","曲艺","生活","游戏互动","财经","求职"]]
    anime_cls = [{"n": "全部", "v": ""}] + [{"n": x, "v": x} for x in
                 ["热血","搞笑","冒险","科幻","剧情","战斗","动画","玄幻","恋爱","校园","奇幻","喜剧","动作","惊悚","悬疑"]]
    common = lambda cls: [
        {"key": "class", "name": "剧情", "value": cls},
        {"key": "area", "name": "地区", "value": areas},
        {"key": "year", "name": "年份", "value": years},
        {"key": "letter", "name": "字母", "value": letters},
        {"key": "by", "name": "排序", "value": bys},
    ]
    return {"1": common(movie_cls), "2": common(tv_cls), "3": common(show_cls), "4": common(anime_cls)}

class Spider(Spider):
    def getName(self):
        return "首页"

    def init(self, extend):
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def parse_list(self, html):
        videos = []
        soup = BeautifulSoup(html, 'html.parser')
        for a in soup.select('a.module-poster-item.module-item'):
            pic = a.select_one('img')
            note = a.select_one('.module-item-note')
            videos.append({
                "vod_id": a.get('href', ''),
                "vod_name": a.get('title', '') or (a.select_one('.module-poster-item-title').get_text(strip=True) if a.select_one('.module-poster-item-title') else ''),
                "vod_pic": pic.get('data-original', '') if pic else '',
                "vod_remarks": note.get_text(strip=True) if note else ''
            })
        return videos

    def homeContent(self, filter):
        result = {"class": []}
        classes = [('电影', '1'), ('剧集', '2'), ('综艺', '3'), ('动漫', '4')]
        for name, tid in classes:
            result["class"].append({"type_id": tid, "type_name": name})
        if filter:
            result["filters"] = build_filters()
        return result

    def homeVideoContent(self):
        detail = requests.get(url=xurl, headers=headers, timeout=15)
        detail.encoding = "utf-8"
        videos = self.parse_list(detail.text)
        result = {'list': videos}
        return result

    def categoryContent(self, cid, pg, filter, ext):
        result = {}
        ext = ext or {}
        if pg:
            page = int(pg)
        else:
            page = 1

        area = ext.get('area', '')
        by = ext.get('by', 'time')
        cls = ext.get('class', '')
        lang = ext.get('lang', '')
        letter = ext.get('letter', '')
        year = ext.get('year', '')

        url = f'{xurl}/show/{cid}-{area}-{by}-{cls}-{lang}-{letter}---{page}---{year}.html'
        detail = requests.get(url=url, headers=headers, timeout=15)
        detail.encoding = "utf-8"
        videos = self.parse_list(detail.text)

        result = {'list': videos}
        result['page'] = pg
        result['pagecount'] = 9999
        result['limit'] = 90
        result['total'] = 999999
        return result

    def detailContent(self, ids):
        did = ids[0]
        result = {}
        videos = []

        url = did if did.startswith('http') else xurl + did
        detail = requests.get(url=url, headers=headers, timeout=15)
        detail.encoding = "utf-8"
        soup = BeautifulSoup(detail.text, 'html.parser')

        title_tag = soup.select_one('h1')
        img_tag = soup.select_one('.lazyload') or soup.select_one('img[data-original]')
        content_tag = soup.select_one('.module-info-introduction')

        play_from = []
        play_url = []
        for tab in soup.select('.hisSwiper .module-tab-item'):
            name = tab.select_one('span')
            if not name:
                continue
            name = name.get_text(strip=True)
            pid = tab.get('data-dropdown-value', '')
            ul = soup.select_one(f'#panel1 .module-play-list-content') if not pid else None
            if not ul:
                ul = soup.select_one('.module-play-list-content')
            if not ul:
                continue
            eps = []
            for a in ul.select('a.module-play-list-link'):
                href = a.get('href', '')
                if href.startswith('/'):
                    href = xurl + href
                ep_name = a.get('title', '') or a.get_text(strip=True)
                eps.append(f"{ep_name}${href}")
            if eps:
                play_from.append(name)
                play_url.append('#'.join(eps))

        if not play_url:
            all_links = soup.select('a.module-play-list-link')
            eps = []
            for a in all_links:
                href = a.get('href', '')
                if href.startswith('/'):
                    href = xurl + href
                ep_name = a.get('title', '') or a.get_text(strip=True)
                eps.append(f"{ep_name}${href}")
            if eps:
                play_from.append('FROK影视')
                play_url.append('#'.join(eps))

        if not play_url:
            return {"list": []}

        videos.append({
            "vod_id": did,
            "vod_name": title_tag.get_text(strip=True) if title_tag else '',
            "vod_pic": img_tag.get('data-original', '') if img_tag else '',
            "vod_content": content_tag.get_text(strip=True) if content_tag else '',
            "vod_play_from": '$$$'.join(play_from),
            "vod_play_url": '$$$'.join(play_url)
        })

        result['list'] = videos
        return result

    def playerContent(self, flag, id, vipFlags):
        result = {}
        purl = id
        parse = 1

        url = id if id.startswith('http') else xurl + id
        detail = requests.get(url=url, headers=headers, timeout=15)
        detail.encoding = "utf-8"

        match = re.search(r'player_\w*\s*=\s*(\{.*?\})\s*</script>', detail.text, re.S)
        if not match:
            match = re.search(r'r player_.*?=(.*?)<', detail.text, re.S)
        if match:
            try:
                raw = match.group(1).strip()
                data = json.loads(raw)
                u = data.get('url', '')
                enc = str(data.get('encrypt', '0'))
                if enc == '1':
                    u = js_unescape(u)
                elif enc == '2':
                    u = js_unescape(base64.b64decode(u).decode('utf-8'))
                if re.search(r'\.(m3u8|mp4)', u) or '.m3u8' in u or '.mp4' in u:
                    purl = u
                    parse = 0
            except Exception:
                pass

        result["parse"] = parse
        result["playUrl"] = ''
        result["url"] = purl
        result["header"] = headers
        return result

    def searchContent(self, key, quick):
        result = {}
        url = f'{xurl}/search/{quote(key)}----------1---.html'
        detail = requests.get(url=url, headers=headers, timeout=15)
        detail.encoding = "utf-8"
        videos = []
        soup = BeautifulSoup(detail.text, 'html.parser')
        for item in soup.select('.module-card-item.module-item'):
            a = item.select_one('a.module-card-item-poster')
            if not a:
                continue
            pic = a.select_one('img')
            note = a.select_one('.module-item-note')
            title = item.select_one('.module-card-item-title')
            videos.append({
                "vod_id": a.get('href', ''),
                "vod_name": title.get_text(strip=True) if title else (pic.get('alt', '') if pic else ''),
                "vod_pic": pic.get('data-original', '') if pic else '',
                "vod_remarks": note.get_text(strip=True) if note else ''
            })
        result['list'] = videos
        return result

    def localProxy(self, params):
        if params['type'] == "m3u8":
            return self.proxyM3u8(params)
        elif params['type'] == "media":
            return self.proxyMedia(params)
        elif params['type'] == "ts":
            return self.proxyTs(params)
        return None
