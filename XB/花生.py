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

xurl = "https://www.gsfangkeji.com"

headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Mobile Safari/537.36'
}

def js_unescape(s):
    s = re.sub(r'%u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)
    return unquote(s)

def build_filters():
    years = [{"n": "全部", "v": ""}] + [{"n": str(y), "v": str(y)} for y in range(2026, 2021, -1)]
    letters = [{"n": "全部", "v": ""}] + [{"n": c, "v": c} for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"] + [{"n": "0-9", "v": "0"}]
    return [
        {"key": "地区", "name": "地区", "value": [{"n": "全部", "v": ""}, {"n": "大陆", "v": "大陆"}]},
        {"key": "年份", "name": "年份", "value": years},
        {"key": "语言", "name": "语言", "value": [{"n": "全部", "v": ""}, {"n": "国语", "v": "国语"}]},
        {"key": "字母", "name": "字母", "value": letters},
        {"key": "排序", "name": "排序", "value": [{"n": "时间", "v": "time"}, {"n": "人气", "v": "hits"}, {"n": "评分", "v": "score"}]},
    ]

class Spider(Spider):
    def getName(self):
        return "首页"

    def init(self, extend):
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def parse_list(self, html, use_data_original=False):
        videos = []
        soup = BeautifulSoup(html, 'html.parser')
        for li in soup.select('ul.stui-vodlist li, ul.stui-vodlist__media li, #searchList li'):
            a = li.select_one('a.stui-vodlist__thumb')
            if not a:
                continue
            pic = ''
            if use_data_original:
                pic = a.get('data-original', '')
            else:
                m = re.search(r'url\((.*?)\)', a.get('style', ''))
                if m:
                    pic = m.group(1)
            remark = li.select_one('.pic-text')
            videos.append({
                "vod_id": a.get('href', ''),
                "vod_name": a.get('title', ''),
                "vod_pic": pic,
                "vod_remarks": remark.get_text(strip=True) if remark else ''
            })
        return videos

    def homeContent(self, filter):
        result = {"class": []}
        classes = [('短剧库', '5'), ('女频恋爱', '5@女频恋爱'), ('反转爽', '5@反转爽'),
                   ('脑洞悬疑', '5@脑洞悬疑'), ('古装仙侠', '5@古装仙侠'), ('现代都市', '5@现代都市')]
        for name, tid in classes:
            result["class"].append({"type_id": tid, "type_name": name})
        if filter:
            f = build_filters()
            result["filters"] = {tid: f for name, tid in classes}
        return result

    def homeVideoContent(self):
        detail = requests.get(url=xurl, headers=headers)
        detail.encoding = "utf-8"
        videos = self.parse_list(detail.text)
        result = {'list': videos}
        return result

    def categoryContent(self, cid, pg, filter, ext):
        result = {}
        videos = []
        ext = ext or {}

        if '@' in cid:
            real_cid, default_plot = cid.split('@', 1)
        else:
            real_cid, default_plot = cid, ''

        area = ext.get('地区', '')
        by = ext.get('排序', '')
        plot = ext.get('剧情', '') or default_plot
        lang = ext.get('语言', '')
        letter = ext.get('字母', '')
        year = ext.get('年份', '')

        if pg:
            page = int(pg)
        else:
            page = 1

        q = lambda s: quote(str(s), safe='') if s else ''
        url = f'{xurl}/hssw/{q(real_cid)}-{q(area)}-{q(by)}-{q(plot)}-{q(lang)}-{q(letter)}---{page}---{q(year)}.html'

        detail = requests.get(url=url, headers=headers)
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
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"
        soup = BeautifulSoup(detail.text, 'html.parser')

        title_tag = soup.select_one('.stui-content__detail .title')
        pic_tag = soup.select_one('.stui-content__thumb .lazyload')
        content_tag = soup.select_one('.stui-content__detail p.detail')

        play_urls = []
        for li in soup.select('ul.stui-content__playlist li'):
            if '滈凊' in li.get_text():
                continue
            a = li.select_one('a')
            if not a or not a.get('href'):
                continue
            href = a['href']
            if href.startswith('/'):
                href = xurl + href
            play_urls.append(f"{a.get_text(strip=True)}${href}")

        if not play_urls:
            return {"list": []}

        videos.append({
            "vod_id": did,
            "vod_name": title_tag.get_text(strip=True) if title_tag else '',
            "vod_pic": pic_tag.get('data-original', '') if pic_tag else '',
            "vod_content": content_tag.get_text(strip=True) if content_tag else '',
            "vod_play_from": '花生短剧',
            "vod_play_url": "#".join(play_urls)
        })

        result['list'] = videos
        return result

    def playerContent(self, flag, id, vipFlags):
        result = {}
        purl = id
        parse = 1

        url = id if id.startswith('http') else xurl + id
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"

        match = re.search(r'r player_.*?=(.*?)</', detail.text)
        if match:
            try:
                data = json.loads(match.group(1).strip())
                u = data.get('url', '')
                enc = str(data.get('encrypt', '0'))
                if enc == '1':
                    u = js_unescape(u)
                elif enc == '2':
                    u = js_unescape(base64.b64decode(u).decode('utf-8'))
                if re.search(r'\.(m3u8|mp4|m4a|mp3)', u):
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
        url = f'{xurl}/hssc/{quote(key)}----------1---.html'
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"
        videos = self.parse_list(detail.text, use_data_original=True)
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