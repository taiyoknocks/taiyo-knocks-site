# トップページ（site/index.html）を、デザインの元データ tools/design/Main.dc.html から作り直すスクリプト。
# 使い方（リポジトリの一番上で）: python3 tools/build_top.py
# 画像は site/images/ にあるものを使う（デザイン側の /_blob/<id> を images/<ファイル名> に置き換える）。
import re, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(os.path.join(ROOT,'tools','design','Main.dc.html'),encoding='utf-8').read()
BLUE,SUN='#1D4FB8','#FFC400'
SITE='https://taiyo-knocks.netlify.app'
TITLE='太陽ノックス 公式サイト｜乃木坂46「太陽ノック」から生まれた奈良県の草野球チーム'
DESC='奈良県発の草野球チーム「太陽ノックス」の公式サイトです。チーム名は乃木坂46の「太陽ノック」から。試合情報、メンバー紹介、お知らせを掲載しています。※乃木坂46とは一切関係ありません。'
FAV="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='18' fill='%231D4FB8'/%3E%3Cpath d='M12 8.5Q18.5 20 12 31.5M28 8.5Q21.5 20 28 31.5' fill='none' stroke='white' stroke-width='2' stroke-dasharray='2.5 2.5'/%3E%3C/svg%3E"
blobs={'b0823de7039306f818627633023c0f97':('hero-wide.jpg','image/jpeg'),'f65cccbbaf1629cbeab1fb81168b0f01':('takuya.jpg','image/jpeg'),'2f63eb13d66302065b940ddf6e0893c0':('buzz-logo.png','image/png'),'991d17ad7ee09eae2185bb933fc63f9a':('tokunaga-logo.png','image/png'),'6d4219f91e126854043b37e5b547a3fa':('topic-fresh.jpg','image/jpeg'),'538194457854373a06e3ea785ee16c1c':('topic-practice.jpg','image/jpeg'),'4d241a27193ecb7985ce636673db4ebf':('thumb-ticket2.jpg','image/jpeg'),'c1c816bfa515df5eb2fb5201ba92ee6c':('game1.jpg','image/jpeg'),'867db88f0e1d709b1dcd7ab7106653d4':('game1-thumb.jpg','image/jpeg'),'63bf6a17e024ffb393530e776606a7ef':('game2-thumb.jpg','image/jpeg'),'85d7010c62df8f02e3645e078f4b0bdd':('game3-thumb.jpg','image/jpeg')}
JS='''<script>
(function(){
var blue='%s',s=0,timer;
var track=document.getElementById('tk-track'),cur=document.getElementById('tk-cur');
var thumbs=Array.prototype.slice.call(document.querySelectorAll('[data-tk-thumb]'));
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function go(i,user){s=(i+3)%%3;track.style.transform='translateX(-'+(s*100)+'%%)';cur.textContent='0'+(s+1);thumbs.forEach(function(t,j){t.style.outlineColor=j===s?blue:'transparent';});if(user)restart();}
function restart(){clearInterval(timer);if(!reduce)timer=setInterval(function(){go(s+1);},6000);}
document.getElementById('tk-prev').addEventListener('click',function(){go(s-1,true);});
document.getElementById('tk-next').addEventListener('click',function(){go(s+1,true);});
thumbs.forEach(function(t,j){t.addEventListener('click',function(){go(j,true);});});
var x0=null;
track.addEventListener('touchstart',function(e){x0=e.touches[0].clientX;},{passive:true});
track.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40)go(dx<0?s+1:s-1,true);x0=null;});
var menu=document.getElementById('tk-menu'),openB=document.getElementById('tk-menu-open');
function setMenu(o){menu.hidden=!o;openB.setAttribute('aria-expanded',o?'true':'false');document.body.style.overflow=o?'hidden':'';}
openB.addEventListener('click',function(){setMenu(true);});
document.getElementById('tk-menu-close').addEventListener('click',function(){setMenu(false);});
Array.prototype.forEach.call(menu.querySelectorAll('a'),function(a){a.addEventListener('click',function(){setMenu(false);});});
Array.prototype.forEach.call(document.querySelectorAll('a[href="#ticket"]'),function(a){a.addEventListener('click',function(){document.getElementById('ticket').open=true;});});
var nw=document.getElementById('tk-news-wrap'),nt=document.getElementById('tk-news-toggle');
if(nw&&nt){nt.addEventListener('click',function(){var o=nw.hidden;nw.hidden=!o;nt.setAttribute('aria-expanded',o?'true':'false');nt.textContent=o?'CLOSE':'VIEW MORE';});}
var bl=document.getElementById('tk-blog-latest');
if(bl&&window.fetch){fetch('/api/blog/posts',{cache:'no-store'}).then(function(r){return r.ok?r.json():{posts:[]};}).then(function(d){
var ps=(d.posts||[]).slice(0,4);
function mk(t,c,tx){var e=document.createElement(t);if(c)e.className=c;if(tx!=null)e.textContent=tx;return e;}
function fd(iso){var x=new Date(new Date(iso).getTime()+324e5),z=function(n){return(n<10?'0':'')+n;};return x.getUTCFullYear()+'/'+z(x.getUTCMonth()+1)+'/'+z(x.getUTCDate())+' '+z(x.getUTCHours())+':'+z(x.getUTCMinutes());}
if(!ps.length){if(bl.firstElementChild)bl.firstElementChild.textContent='まだ記事はありません。最初の1本をお楽しみに。';return;}
var BALL='<svg viewBox="0 0 40 40" width="64" height="64" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="'+blue+'"></circle><path d="M12 8.5 Q18.5 20 12 31.5" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-dasharray="2.5 2.5"></path><path d="M28 8.5 Q21.5 20 28 31.5" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-dasharray="2.5 2.5"></path></svg>';
bl.textContent='';bl.removeAttribute('style');bl.className='tk-cards';
ps.forEach(function(p){var li=mk('li'),a=mk('a','tk-card');a.href='/blog/post.html?id='+encodeURIComponent(p.id);
var w=mk('div','tk-card-who');w.appendChild(mk('span','tk-card-av',String(p.author.no)));w.appendChild(mk('span','tk-card-name',p.author.name));a.appendChild(w);
if(p.thumb){var im=mk('img','tk-card-img');im.src=p.thumb;im.alt='';im.loading='lazy';im.decoding='async';a.appendChild(im);}else{var ph=mk('div','tk-card-ph');ph.innerHTML=BALL;a.appendChild(ph);}
a.appendChild(mk('div','tk-card-title',p.title));a.appendChild(mk('div','tk-card-date',fd(p.date)));li.appendChild(a);bl.appendChild(li);});
}).catch(function(){});}
restart();
})();
</script>
'''%BLUE
GA='''<!-- Google アナリティクス（アクセス数を見る用。?notrack で開いたスマホは数えない、?track で元に戻す） -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-8MWGBDW4TZ"></script>
<script>
(function(){
var ID='G-8MWGBDW4TZ';
try{var q=location.search;
if(/[?&]notrack\\b/.test(q))localStorage.setItem('tk_notrack','1');
if(/[?&]track\\b/.test(q))localStorage.removeItem('tk_notrack');
if(localStorage.getItem('tk_notrack')==='1')window['ga-disable-'+ID]=true;}catch(e){}
window.dataLayer=window.dataLayer||[];
window.gtag=function(){dataLayer.push(arguments);};
gtag('js',new Date());
gtag('config',ID,{});
})();
</script>
'''
CARD_CSS='''<style>
/* ブログのカード（乃木坂と同じ2列。アイコンはメンバー欄の背番号を丸く切り取った形） */
.tk-cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tk-cards li{display:flex;min-width:0}
.tk-card{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:12px;padding:12px 14px 14px;border:1px solid #CDD3DE;background:#FFFFFF;color:#1A2233;text-decoration:none}
.tk-card-who{display:flex;align-items:center;gap:10px;min-width:0}
.tk-card-av{flex:0 0 30px;width:30px;height:30px;border-radius:50%;background:#EEF3FB;display:flex;align-items:center;justify-content:center;font-family:'Cinzel','Times New Roman',serif;font-weight:600;font-size:13px;line-height:1;color:#1D4FB8}
.tk-card-name{min-width:0;font-size:12px;letter-spacing:.1em;color:#5B6478;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tk-card-img{display:block;width:100%;aspect-ratio:10/11;object-fit:cover;background:#EEF3FB;clip-path:polygon(0 0,100% 0,100% 82%,0 100%)}
.tk-card-ph{width:100%;aspect-ratio:10/11;display:flex;align-items:center;justify-content:center}
.tk-card-title{font-size:13px;line-height:1.65;letter-spacing:.08em;color:#3D4352;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.tk-card-date{margin-top:auto;font-family:'Cinzel','Times New Roman',serif;font-size:11px;letter-spacing:.08em;color:#5B6478}
@media (hover:hover){.tk-card:hover{border-color:#1D4FB8;color:#1A2233}}
</style>
'''
def build(mode):
    s=src
    for k,v in {'{{blue}}':BLUE,'{{sun}}':SUN,'{{trackStyle}}':'translateX(-0%)','{{pager}}':'01','{{t0}}':BLUE,'{{t1}}':'transparent','{{t2}}':'transparent','aria-expanded="{{menuOpen}}"':'aria-expanded="false"','aria-expanded="{{newsOpen}}"':'aria-expanded="false"','{{newsLabel}}':'VIEW MORE'}.items(): s=s.replace(k,v)
    s=re.sub(r' onClick="\{\{[A-Za-z0-9]+\}\}"','',s)
    s=s.replace('<sc-if value="{{menuOpen}}" hint-placeholder-val="{{ false }}">','<div id="tk-menu" hidden>')
    s=s.replace('<sc-if value="{{newsOpen}}" hint-placeholder-val="{{ false }}">','<div id="tk-news-wrap" hidden>').replace('</sc-if>','</div>')
    for bid,(f,m) in blobs.items():
        s=s.replace('/_blob/'+bid,'images/'+f)
    helmet=re.search(r'<helmet>(.*?)</helmet>',s,re.S).group(1)
    s=re.sub(r'<helmet>.*?</helmet>\s*','',s,flags=re.S)
    helmet=helmet.replace('body{margin:0;background:#E3E9F4}',
     ':root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}\nbody{margin:0;background:#E3E9F4}\nbody::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:30;background:#FFFFFF}\n@media (prefers-reduced-motion: reduce){#tk-track{transition:none !important}}')
    helmet=helmet.replace('scroll-padding-top:64px','scroll-padding-top:calc(env(safe-area-inset-top,0px) + 64px)')
    meta='<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="description" content="%s">\n<link rel="icon" href="%s">\n'%(DESC,FAV)
    if mode=='netlify':
        meta+=('<meta property="og:type" content="website">\n<meta property="og:site_name" content="太陽ノックス 公式サイト">\n'
               '<meta property="og:title" content="%s">\n<meta property="og:description" content="%s">\n'
               '<meta property="og:url" content="%s/">\n<meta property="og:image" content="%s/images/ogp.jpg">\n'
               '<meta name="twitter:card" content="summary_large_image">\n')%(TITLE,DESC,SITE,SITE)
    s=s.replace('<script src="./support.js"></script>',meta+helmet.strip())
    s=re.sub(r'<title>.*?</title>','<title>%s</title>'%TITLE,s,count=1)
    s=s.replace('<header style="position: sticky; top: 0;','<header style="position: sticky; top: env(safe-area-inset-top, 0px);')
    s=s.replace('padding: 4px 16px 48px; display: flex; flex-direction: column; gap: 20px">','padding: calc(env(safe-area-inset-top, 0px) + 4px) 16px 48px; display: flex; flex-direction: column; gap: 20px">',1)
    s=s.replace('<x-dc>\n','').replace('</x-dc>\n','')
    s=re.sub(r'<script type="text/x-dc".*?</script>\s*','',s,flags=re.S)
    s=s.replace('</body>',JS+'</body>')
    s=s.replace('</head>',CARD_CSS+'</head>',1)
    s=s.replace('</head>',GA+'</head>',1)
    assert '{{' not in s and 'x-dc' not in s and 'support.js' not in s and '_blob' not in s and 'sc-if' not in s and 'onClick' not in s
    return s
out=build('netlify')
for f in set(re.findall(r'images/([A-Za-z0-9_.-]+\.(?:jpg|png))',out)):
    assert os.path.exists(os.path.join(ROOT,'site','images',f)), 'site/images/ に無い画像: '+f
open(os.path.join(ROOT,'site','index.html'),'w',encoding='utf-8').write(out)
print('site/index.html を作り直しました')
