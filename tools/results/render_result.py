# 試合結果欄（RESULT）を tools/results/games.json から作る。games.json は新しい試合が上。
# 使い方: python3 tools/results/render_result.py           → 作った欄を表示するだけ
#         python3 tools/results/render_result.py --apply   → tools/design/Main.dc.html の #result を置き換える（そのあと build_top.py）
# ルール（しみさんと決めたもの）: 勝ち試合は「勝」、負け試合は「負」（引き分けはどちらもなし）。「本」は毎試合出し、なければ「なし」。
# 「ALL GAMES（これまでの試合）」は2試合目から出す。最初の3試合だけ見せて残りは VIEW MORE。
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
games = json.load(open(args[0] if args else os.path.join(HERE, 'games.json'), encoding='utf-8'))
SHOW = 3  # 最初に見せる行数
BLUE = '{{blue}}'
CIN = "font-family: 'Cinzel', 'Times New Roman', serif"
MIN = "font-family: 'Shippori Mincho', 'Hiragino Mincho ProN', serif"

def result(g):
    a, b = sum(g['us']), sum(g['them'])
    return ('WIN' if a > b else 'LOSE' if a < b else 'DRAW'), a, b

def badge(r, small=False):
    bg = {'WIN': '{{sun}}', 'LOSE': '#5B6478', 'DRAW': '#D6DDEA'}[r]
    fg = {'WIN': '#1A2233', 'LOSE': '#FFFFFF', 'DRAW': '#1A2233'}[r]
    h, pad, fs = ('20px', '0 8px', '10px') if small else ('22px', '0 12px', '11px')
    return f'<span style="display: inline-flex; align-items: center; justify-content: center; min-width: {"48px" if small else "0"}; min-height: {h}; padding: {pad}; background: {bg}; color: {fg}; {CIN}; font-size: {fs}; font-weight: 600; letter-spacing: 0.16em">{r}</span>'

def table(g):
    n = len(g['us'])
    th = 'padding: 8px 0; font-size: 11px; font-weight: 700; color: #5B6478; text-align: center; border-bottom: 1px solid #D6DDEA'
    td = f"padding: 10px 0; text-align: center; {CIN}; font-size: 15px; font-weight: 600; border-bottom: 1px solid #D6DDEA"
    tt = f"padding: 10px 0; text-align: center; {CIN}; font-size: 16px; font-weight: 600; color: {BLUE}; background: #EEF3FB; border-bottom: 1px solid #D6DDEA"
    rh = 'padding: 10px 6px 10px 0; text-align: left; font-size: 12px; font-weight: 700; white-space: nowrap; border-bottom: 1px solid #D6DDEA'
    cols = '<col style="width: 30%">' + '<col>' * n + '<col style="width: 14%">'
    head = f'<th scope="col" style="{th}"></th>' + ''.join(f'<th scope="col" style="{th}">{i+1}</th>' for i in range(n)) + f'<th scope="col" style="{th}">計</th>'
    def row(name, xs): return f'<tr><th scope="row" style="{rh}">{name}</th>' + ''.join(f'<td style="{td}">{x}</td>' for x in xs) + f'<td style="{tt}">{sum(xs)}</td></tr>'
    return (f'<div style="overflow-x: auto"><table style="width: 100%; border-collapse: collapse; table-layout: fixed">'
            f'<caption style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">イニングごとのスコア</caption>'
            f'<colgroup>{cols}</colgroup><thead><tr>{head}</tr></thead><tbody>{row("太陽ノックス", g["us"])}{row(g["oppShort"], g["them"])}</tbody></table></div>')

def notes(g):
    r = result(g)[0]
    rows = []
    p = g.get('pitcher')
    if r != 'DRAW' and p:
        rows.append(('勝' if r == 'WIN' else '負', p['name'], f'背番号{p["no"]}'))
    hrs = g.get('hr') or []
    if hrs:
        for h in hrs:
            rows.append(('本', h['name'], f'背番号{h["no"]}' + (f'・{h["kind"]}' if h.get('kind') else '')))
    else:
        rows.append(('本', 'なし', None))
    dt = 'flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid #8A93A8; background: #FFFFFF; font-size: 13px; font-weight: 700'
    def dd(who, sub):
        if sub is None: return f'<dd style="margin: 0; font-size: 14px; font-weight: 500; color: #5B6478">{who}</dd>'
        return f'<dd style="margin: 0; font-size: 14px; font-weight: 700">{who}<span style="font-weight: 500; color: #5B6478">（{sub}）</span></dd>'
    items = ''.join(f'<div style="display: flex; align-items: center; gap: 12px"><dt style="{dt}">{k}</dt>{dd(who, sub)}</div>' for k, who, sub in rows)
    return f'<dl style="margin: 0; padding: 14px 14px; background: #EEF3FB; display: flex; flex-direction: column; gap: 10px">{items}</dl>'

def meta(g, big=True):
    return (f'<p style="margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px"><span style="font-size: 11px; font-weight: 700; color: {BLUE}">{g["kind"]}</span>'
            + (f'<span style="{CIN}; font-weight: 600; font-size: 20px">{g["date"]}</span><span style="font-size: 12px; font-weight: 700">{g["dow"]}</span>' if big else '')
            + f'<span style="font-size: 12px; color: #5B6478">{g["place"]}</span></p>')

def big_card(g):
    r, a, b = result(g)
    photo = f'<img src="{g["photo"]}" alt="{g["photoAlt"]}" style="display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: cover">' if g.get('photo') else ''
    return (f'<article style="border: 1px solid #D6DDEA; display: flex; flex-direction: column">{photo}'
            f'<div style="padding: 20px 16px 22px; display: flex; flex-direction: column; gap: 16px">'
            f'<p style="margin: 0; {CIN}; font-size: 10px; font-weight: 600; letter-spacing: 0.2em; color: {BLUE}">LATEST GAME</p>'
            f'{meta(g)}'
            f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: center">'
            f'<p style="margin: 0; flex: 1 1 0; min-width: 0; {MIN}; font-weight: 600; font-size: 15px; line-height: 1.5">太陽ノックス</p>'
            f'<p style="margin: 0; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="{CIN}; font-weight: 600; font-size: 44px; line-height: 1; letter-spacing: 0.04em">{a}<span style="font-size: 24px; color: #8A93A8; padding: 0 8px">－</span>{b}</span>{badge(r)}</p>'
            f'<p style="margin: 0; flex: 1 1 0; min-width: 0; {MIN}; font-weight: 600; font-size: 15px; line-height: 1.5">{g["opp"]}</p></div>'
            f'{table(g)}{notes(g)}</div></article>')

def season(gs):
    gs = [g for g in gs if g['year'] == gs[0]['year']]
    rs = [result(g)[0] for g in gs]
    w, l, d = rs.count('WIN'), rs.count('LOSE'), rs.count('DRAW')
    runs, allowed = sum(sum(g['us']) for g in gs), sum(sum(g['them']) for g in gs)
    num = f'{CIN}; font-weight: 600; font-size: 30px; line-height: 1; color: {BLUE}'
    unit = 'font-size: 13px; font-weight: 700; margin: 0 10px 0 3px'
    return (f'<div style="border: 1px solid {BLUE}; padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 10px">'
            f'<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px"><span style="{CIN}; font-weight: 600; font-size: 13px; letter-spacing: 0.18em; color: {BLUE}">{gs[0]["year"]} SEASON</span><span style="font-size: 12px; color: #5B6478">{len(gs)}試合</span></div>'
            f'<p style="margin: 0; display: flex; align-items: baseline; justify-content: center"><span style="{num}">{w}</span><span style="{unit}">勝</span><span style="{num}">{l}</span><span style="{unit}">敗</span><span style="{num}">{d}</span><span style="{unit}">分</span></p>'
            f'<p style="margin: 0; text-align: center; font-size: 12px; color: #5B6478">得点 {runs}　失点 {allowed}</p></div>')

def row(g):
    r, a, b = result(g)
    summ = (f'<summary class="tk-res-sum" style="display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 8px 2px; cursor: pointer; list-style: none">'
            f'<span style="flex: 0 0 64px; display: flex; flex-direction: column; gap: 2px"><span style="{CIN}; font-weight: 600; font-size: 16px; line-height: 1.1">{g["date"]}</span><span style="font-size: 10px; color: #5B6478">{g["dow"]}</span></span>'
            f'<span style="flex: 1 1 auto; min-width: 0; font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">vs {g["oppShort"]}</span>'
            f'<span style="flex: 0 0 auto; {CIN}; font-weight: 600; font-size: 16px">{a}<span style="color: #8A93A8; padding: 0 3px">－</span>{b}</span>'
            f'{badge(r, small=True)}'
            f'<svg class="tk-res-chev" viewBox="0 0 14 8" width="12" height="8" fill="none" stroke="{BLUE}" stroke-width="1.5" aria-hidden="true" style="flex: 0 0 12px; transition: transform 0.2s"><path d="M1 1l6 6 6-6"></path></svg></summary>')
    body = f'<div style="padding: 4px 2px 18px; display: flex; flex-direction: column; gap: 14px">{meta(g, big=False)}{table(g)}{notes(g)}</div>'
    return f'<details style="border-bottom: 1px solid #D6DDEA">{summ}{body}</details>'

latest = games[0]
rows = [row(g) for g in games]
more = ''
if len(rows) > SHOW:
    more = (f'<div id="tk-res-more" hidden>{"".join(rows[SHOW:])}</div>'
            f'<button id="tk-res-toggle" type="button" aria-expanded="false" aria-controls="tk-res-more" style="margin-top: 20px; align-self: center; display: flex; align-items: center; justify-content: center; width: 100%; max-width: 300px; min-height: 48px; border: 0; background: {BLUE}; color: #FFFFFF; {CIN}; font-weight: 500; font-size: 13px; letter-spacing: 0.24em; cursor: pointer">VIEW MORE</button>')
# 「これまでの試合」は2試合目から（1試合だけだと上のカードと同じになるため）
all_games = ''
if len(games) >= 2:
    all_games = (f'<div style="display: flex; flex-direction: column">\n'
                 f'<h3 style="margin: 8px 0 6px; display: flex; align-items: baseline; gap: 10px"><span style="{CIN}; font-weight: 600; font-size: 14px; letter-spacing: 0.16em; color: {BLUE}">ALL GAMES</span><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #5B6478">これまでの試合</span></h3>\n'
                 f'<div style="border-top: 1px solid #D6DDEA">{"".join(rows[:SHOW])}</div>\n{more}\n</div>\n')
dummy_note = '<p style="margin: 0; padding: 8px 10px; background: #FDF1F0; color: #B3261E; font-size: 12px; font-weight: 700">※見本です。11.23 以外の試合はダミーの結果です。</p>' if any(g.get('dummy') for g in games) else ''
html = f'''<section id="result" style="background: #FFFFFF">
<style>.tk-res-sum::-webkit-details-marker{{display:none}} details[open] > .tk-res-sum .tk-res-chev{{transform: rotate(180deg)}}</style>
<div style="padding: 44px 16px 52px; display: flex; flex-direction: column; gap: 20px">
<div style="display: flex; flex-direction: column; gap: 10px">
<h2 style="margin: 0; display: flex; align-items: baseline; gap: 12px"><span style="{CIN}; font-weight: 500; font-size: 24px; letter-spacing: 0.16em; color: {BLUE}">RESULT</span><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: #5B6478">試合結果</span></h2>
<span aria-hidden="true" style="height: 1px; background: {BLUE}"></span>
</div>
{dummy_note}
{big_card(latest)}
{season(games)}
{all_games}</div>
<script>(function(){{var b=document.getElementById('tk-res-toggle'),m=document.getElementById('tk-res-more');if(b&&m)b.addEventListener('click',function(){{var o=m.hidden;m.hidden=!o;b.setAttribute('aria-expanded',o?'true':'false');b.textContent=o?'CLOSE':'VIEW MORE';}});}})();</script>
</section>
'''
if '--apply' in sys.argv:
    p = os.path.join(ROOT, 'tools', 'design', 'Main.dc.html')
    s = open(p, encoding='utf-8').read()
    start = s.index('<section id="result"'); end = s.index('</section>', start) + len('</section>\n')
    open(p, 'w', encoding='utf-8').write(s[:start] + html + s[end:])
    print('tools/design/Main.dc.html の試合結果欄を置き換えました')
else:
    print(html)
