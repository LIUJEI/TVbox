# coding=utf-8
#!/usr/bin/python

from urllib.parse import quote, unquote
from base.spider import Spider
import requests
import sys
import re

sys.path.append('..')

xurl = "http://wapi.kuwo.cn"

headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Mobile Safari/537.36',
    'Referer': 'http://www.kuwo.cn/',
    'Origin': 'http://www.kuwo.cn'
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

    def homeContent(self, filter):
        result = {"class": []}
        names = '土味爱情&更多精彩&霸道总裁的人生&赘婿当道&漫漫追妻路&家庭情感&逆袭重生&动画&日常&其他'.split('&')
        ids = '11&12&13&14&15&16&17&19&20&24'.split('&')
        for i in range(len(names)):
            result["class"].append({"type_id": ids[i], "type_name": names[i]})
        return result

    def homeVideoContent(self):
        videos = []

        url = f'{xurl}/openapi/v1/shortplay/moduleMore?currentPage=1&moduleId=10&rn=12'
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"
        data = detail.json()

        if data.get('data') and data['data'].get('list'):
            for vod in data['data']['list']:
                video = {
                    "vod_id": str(vod['url']) + '||' + quote(vod.get('subTitle') or '', safe=''),
                    "vod_name": vod['title'],
                    "vod_pic": vod['img'],
                    "vod_remarks": vod.get('currrentDesc') or ''
                }
                videos.append(video)

        result = {'list': videos}
        return result

    def categoryContent(self, cid, pg, filter, ext):
        result = {}
        videos = []

        if pg:
            page = int(pg)
        else:
            page = 1

        url = f'{xurl}/openapi/v1/shortplay/moduleMore?currentPage={page}&moduleId={cid}&rn=12'
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"
        data = detail.json()

        if data.get('data') and data['data'].get('list'):
            for vod in data['data']['list']:
                video = {
                    "vod_id": str(vod['url']) + '||' + quote(vod.get('subTitle') or '', safe=''),
                    "vod_name": vod['title'],
                    "vod_pic": vod['img'],
                    "vod_remarks": vod.get('currrentDesc') or ''
                }
                videos.append(video)

        result = {'list': videos}
        result['page'] = pg
        result['pagecount'] = 9999
        result['limit'] = 12
        result['total'] = 999999
        return result

    def detailContent(self, ids):
        did = ids[0]
        result = {}
        videos = []

        parts = did.split('||')
        album_id = parts[0]
        sub_title = unquote(parts[1]) if len(parts) > 1 else ''

        url = f'{xurl}/openapi/v1/shortplay/videoList?albumId={album_id}'
        detail = requests.get(url=url, headers=headers)
        detail.encoding = "utf-8"
        detail = detail.json()

        if not detail or 'data' not in detail or not detail['data']:
            return {"list": []}

        data = detail['data']

        if 'list' in data and data['list']:
            sorted_list = sorted(data['list'], key=lambda x: x.get('location', 0))
            play_urls = []
            for index, item in enumerate(sorted_list):
                vid = item.get('mvpayinfo', {}).get('vid', '')
                if vid:
                    play_url = f'http://nmobi.kuwo.cn/mobi.s?f=web&type=get_url_by_vid&vid={vid}'
                    play_urls.append(f"第{index + 1}集${play_url}")

            if play_urls:
                bofang = "#".join(play_urls)
                xianlu = '小酷短剧'
            else:
                return {"list": []}
        else:
            return {"list": []}

        info = data.get('shortinfo', {})

        videos.append({
            "vod_id": str(info.get('id', album_id)),
            "vod_remarks": f"共{info.get('total', 0)}集",
            "vod_content": sub_title or info.get('title', ''),
            "vod_play_from": xianlu,
            "vod_play_url": bofang
        })

        result['list'] = videos
        return result

    def playerContent(self, flag, id, vipFlags):
        result = {}
        purl = id

        if 'nmobi.kuwo.cn/mobi.s' in id and 'get_url_by_vid' in id:
            detail = requests.get(url=id, headers=headers)
            detail.encoding = "utf-8"

            match = re.search(r'url=(\S+?\.mp4)', detail.text)
            if match:
                purl = match.group(1).strip()
            else:
                for line in detail.text.split('\n'):
                    if line.startswith('url='):
                        purl = line[4:].strip().split('format=')[0]
                        break

        result["parse"] = 0
        result["playUrl"] = ''
        result["url"] = purl
        result["header"] = headers
        return result

    def searchContent(self, key, quick):
        result = {}
        videos = []
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