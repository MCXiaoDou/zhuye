# -*- coding: utf-8 -*-
r"""
update_news.py — 刷新主页「最新新闻」的静态兜底池
================================================
抓取中新网滚动新闻 RSS（主源）或人民网时政 RSS（备源），
取最新 15 条写入 script.js 的 NEWS_POOL。抓取失败时不动旧数据。

注意：页面上的新闻是「每次打开都现拉 60s API」（见 script.js 6.5 段），
本脚本只负责刷新最后一层静态兜底池（API 不可用且无缓存时才会显示它），
所以不必每天定时跑，想刷新时手动执行一次即可。

用法：
    python update_news.py            # 更新并打印摘要

若仍想定时自动跑，可注册 Windows 任务计划（可选，非必需）：
    schtasks /Create /TN "YYsuni-daily-news" /SC DAILY /ST 07:30 /F ^
        /TR "\"<python路径>\" \"<本项目>\update_news.py\""

零依赖：仅用 Python 标准库（urllib / xml.etree / re）。
"""
import json
import re
import ssl
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

# ---- 配置 ----
PROJECT = Path(__file__).resolve().parent
SCRIPT_JS = PROJECT / "script.js"
MAX_ITEMS = 15          # 写入池子的新闻条数
POOL_SIZE_MIN = 8       # 少于这个数视为抓取失败，不动旧池

# 主源：中新网滚动新闻（中央级，更新频繁）；备源：人民网时政频道
FEEDS = [
    {"name": "中国新闻网", "url": "https://www.chinanews.com/rss/scroll-news.xml"},
    {"name": "人民网", "url": "http://www.people.com.cn/rss/politics.xml"},
]

# 负面/不宜放个人主页的标题关键词（案件、灾难类），命中即跳过
BLACKLIST = [
    "双开", "被查", "被捕", "逮捕", "受贿", "贪污", "判刑", "死刑",
    "遇难", "身亡", "死亡", "伤亡", "坠", "爆炸", "火灾", "地震",
    "袭击", "冲突", "制裁", "案",
]

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as r:
        return r.read()


def parse_rss(xml_bytes: bytes):
    """解析 RSS 2.0，返回 [(title, link, pubDate), ...]"""
    root = ET.fromstring(xml_bytes)
    out = []
    for it in root.findall(".//item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        pub = (it.findtext("pubDate") or "").strip()
        if title and link:
            out.append((title, link, pub))
    return out


def fmt_date(pub: str) -> str:
    """RFC822 → MM-DD；解析失败用今天"""
    try:
        return datetime.strptime(pub[:16], "%a, %d %b %Y").strftime("%m-%d")
    except ValueError:
        return datetime.now().strftime("%m-%d")


def collect():
    """逐个源尝试，返回足够条目即返回"""
    for feed in FEEDS:
        try:
            items = parse_rss(fetch(feed["url"]))
            news = []
            for title, link, pub in items:
                if any(k in title for k in BLACKLIST):
                    continue
                news.append({"t": title, "s": feed["name"], "u": link, "d": fmt_date(pub)})
                if len(news) >= MAX_ITEMS:
                    break
            if len(news) >= POOL_SIZE_MIN:
                return feed["name"], news
            print(f"[warn] {feed['name']} 仅解析出 {len(news)} 条，尝试下一源")
        except Exception as e:
            print(f"[warn] {feed['name']} 抓取失败：{e}")
    return None, None


def js_items(news):
    lines = ",\n".join(
        "    { t: %s, s: %s, u: %s, d: %s }" % (
            json.dumps(n["t"], ensure_ascii=False),
            json.dumps(n["s"], ensure_ascii=False),
            json.dumps(n["u"], ensure_ascii=False),
            json.dumps(n["d"], ensure_ascii=False),
        )
        for n in news
    )
    return "const NEWS_POOL = [\n" + lines + ",\n  ];"


def main():
    source, news = collect()
    if not news:
        print("[fail] 所有源都不可用，保留旧新闻池不动")
        sys.exit(1)

    js = SCRIPT_JS.read_text(encoding="utf-8")
    new_pool, n = re.subn(
        r"const NEWS_POOL = \[.*?\];",
        js_items(news).replace("\\", "\\\\"),
        js, count=1, flags=re.S,
    )
    if n != 1:
        print("[fail] 在 script.js 中未找到 NEWS_POOL 段")
        sys.exit(1)

    SCRIPT_JS.write_text(new_pool, encoding="utf-8")
    print(f"[ok] {datetime.now():%Y-%m-%d %H:%M}  已从 {source} 更新 {len(news)} 条新闻：")
    for x in news[:3]:
        print(f"     - {x['t']}  ({x['s']} {x['d']})")


if __name__ == "__main__":
    main()
