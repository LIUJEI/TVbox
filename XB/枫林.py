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

xurl = "https://8maple.st"

headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Mobile Safari/537.36'
}

def js_unescape(s):
    s = re.sub(r'%u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)
    return unquote(s)

def build_filters():
    return {
        "movie": [{"key": "cateId", "name": "分类", "value": [
            {"n": "全部", "v": "movie"}, {"n": "动作片", "v": "action"}, {"n": "喜剧片", "v": "comedy"},
            {"n": "科幻片", "v": "sciencefiction"}, {"n": "恐怖片", "v": "horror"}, {"n": "爱情片", "v": "love"},
            {"n": "战争片", "v": "war"}, {"n": "剧情片", "v": "drama"}, {"n": "动画电影", "v": "cartoon"},
            {"n": "纪录片", "v": "documentary"}]}],
        "tv": [{"key": "cateId", "name": "分类", "value": [
            {"n": "全部", "v": "tv"}, {"n": "国产剧", "v": "cn"}, {"n": "港剧", "v": "hk"},
            {"n": "台剧", "v": "tw"}, {"n": "韩剧", "v": "kr"}, {"n": "日剧", "v": "jp"},
            {"n": "美剧", "v": "us"}, {"n": "泰剧", "v": "taidrama"}, {"n": "其他剧", "v": "etc"}]}],
        "show": [{"key": "cateId", "name": "分类", "value": [
            {"n": "全部", "v": "show"}, {"n": "国产综艺", "v": "cntvshow"}, {"n": "日韩综艺", "v": "jpkrtvshow"},
            {"n": "欧美综艺", "v": "ustvshow"}, {"n": "港台综艺", "v": "twhktvshow"}]}],
        "anime": [{"key": "cateId", "name": "分类", "value": [
            {"n": "全部", "v": "anime"}, {"n": "日韩动漫", "v": "jpkranime"}, {"n": "国产动漫", "v": "cnanime"},
            {"n": "欧美动漫", "v": "usanime"}]}]
    }

class Spider(Spider):
    def getName(self):
        return "首页"

    def init(self, extend):
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def parse_list(self, html, remark_idx=1):
        videos = []
        soup = BeautifulSoup(html, 'html.parser')
        for li in soup.select('ul.myui-vodlist li'):
            a = li.select_one('a.myui-vodlist__thumb')
            if not a:
                continue
            pics = li.select('.pic-text')
            remark = pics[remark_idx].get_text(strip=True) if len(pics) > remark_idx else ''
            videos.append({
                "vod_id": a.get('href', ''),
                "vod_name": a.get('title', ''),
                "vod_pic": a.get('data-original', ''),
                "vod_remarks": remark
            })
        return videos

    def homeContent(self, filter):
        result = {"class": []}
        classes = [('电影', 'movie'), ('电视剧', 'tv'), ('综艺', 'show'), ('动漫', 'anime')]
        for name, tid in classes:
            result["class"].append({"type_id": tid, "type_name": name})
        if filter:
            result["filters"] = build_filters()
        return result

    def homeVideoContent(self):
        detail = requests.get(url=xurl, headers=headers)
        detail.encoding = "utf-8"
        videos = self.parse_list(detail.text, remark_idx=0)
        result = {'list': videos}
        return result

    def categoryContent(self, cid, pg, filter, ext):
        result = {}
        videos = []
        ext = ext or {}

        cate_id = ext.get('cateId', '') or cid
        if pg:
            page = int(pg)
        else:
            page = 1

        url = f'{xurl}/filter/{cate_id}--------{page}---.html'
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"
        videos = self.parse_list(detail.text, remark_idx=1)

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

        title_tag = soup.select_one('.myui-content__detail .title')
        pic_tag = soup.select_one('.myui-content__thumb .lazyload')
        content_tag = soup.select_one('.content')

        play_from = []
        play_url = []
        for tab in soup.select('a[href^="#playlist"]'):
            pid = tab.get('href', '').lstrip('#')
            name = tab.get_text(strip=True)
            ul = soup.select_one(f'#{pid} ul.myui-content__list') if pid else None
            if not ul:
                continue
            eps = []
            for a in ul.select('li a'):
                href = a.get('href', '')
                if href.startswith('//'):
                    href = 'https:' + href
                elif href.startswith('/'):
                    href = xurl + href
                eps.append(f"{a.get_text(strip=True)}${href}")
            if eps:
                play_from.append(name)
                play_url.append('#'.join(eps))

        if not play_url:
            return {"list": []}

        videos.append({
            "vod_id": did,
            "vod_name": title_tag.get_text(strip=True) if title_tag else '',
            "vod_pic": pic_tag.get('data-original', '') if pic_tag else '',
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
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"

        match = re.search(r'player_\w*\s*=\s*(\{.*?\})\s*</script>', detail.text, re.S)
        if match:
            try:
                data = json.loads(match.group(1).strip())
                u = data.get('url', '')
                enc = str(data.get('encrypt', '0'))
                if enc == '1':
                    u = js_unescape(u)
                elif enc == '2':
                    u = js_unescape(base64.b64decode(u).decode('utf-8'))
                if re.search(r'\.(m3u8|mp4)', u):
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
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"
        videos = self.parse_list(detail.text, remark_idx=0)
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
