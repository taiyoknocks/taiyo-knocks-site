/* 太陽ノックス メンバーブログ共通の処理（一覧・記事・投稿ページで使う） */
(function () {
  var TK = (window.TK = window.TK || {});
  var membersPromise = null;

  TK.getMembers = function () {
    if (!membersPromise) {
      membersPromise = fetch('/blog/members.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    }
    return membersPromise;
  };

  TK.memberByNo = function (members, no) {
    for (var i = 0; i < members.length; i++) if (members[i].no === no) return members[i];
    return null;
  };

  // 日本時間で「2026.11.28 12:00」
  TK.fmtDate = function (iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var j = new Date(d.getTime() + 9 * 3600 * 1000);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var s = j.getUTCFullYear() + '.' + p(j.getUTCMonth() + 1) + '.' + p(j.getUTCDate());
    if (withTime !== false) s += ' ' + p(j.getUTCHours()) + ':' + p(j.getUTCMinutes());
    return s;
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  TK.el = el;

  TK.authorBlock = function (author, member) {
    var wrap = el('div', 'tk-author');
    wrap.appendChild(el('div', 'tk-author-no', String(author.no)));
    var info = el('div');
    var name = el('div', 'tk-author-name', author.name);
    info.appendChild(name);
    var subText = '背番号' + author.no;
    if (member && member.role) subText = member.role + '・' + subText;
    if (member && member.oshi) subText += '　推し：' + member.oshi;
    info.appendChild(el('div', 'tk-author-sub', subText));
    wrap.appendChild(info);
    return wrap;
  };

  // 記事を描く（本番の記事ページとプレビューで同じ見た目にするため共通化）
  TK.renderArticle = function (post, container, members) {
    container.textContent = '';
    var art = el('article', 'tk-article');
    var head = el('header', 'tk-art-head');
    head.appendChild(el('div', 'tk-art-date', TK.fmtDate(post.date)));
    head.appendChild(el('h1', 'tk-art-title', post.title));
    head.appendChild(TK.authorBlock(post.author, TK.memberByNo(members || [], post.author.no)));
    art.appendChild(head);
    var body = el('div', 'tk-art-body');
    var imgCount = 0;
    (post.blocks || []).forEach(function (b) {
      if (b.type === 'text') {
        var t = b.text.replace(/^\n+|\n+$/g, '');
        if (t) body.appendChild(el('p', 'tk-art-text', t));
      } else if (b.type === 'image') {
        imgCount++;
        var fig = el('figure', 'tk-art-fig');
        var img = document.createElement('img');
        img.src = b.src || b.data;
        img.alt = post.title + '（写真' + imgCount + '）';
        img.loading = imgCount > 1 ? 'lazy' : 'eager';
        img.decoding = 'async';
        fig.appendChild(img);
        body.appendChild(fig);
      }
    });
    art.appendChild(body);
    container.appendChild(art);
    return art;
  };

  // チームのボールマーク（写真がない記事や、メンバー未選択の枠に使う）
  TK.ballMark = function (size) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '20'); c.setAttribute('cy', '20'); c.setAttribute('r', '18'); c.setAttribute('fill', '#1D4FB8');
    svg.appendChild(c);
    ['M12 8.5 Q18.5 20 12 31.5', 'M28 8.5 Q21.5 20 28 31.5'].forEach(function (d) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#FFFFFF');
      p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-dasharray', '2.5 2.5');
      svg.appendChild(p);
    });
    return svg;
  };

  // 一覧の1行（左に正方形の写真、右にタイトルと日時）
  TK.listRow = function (p) {
    var li = el('li');
    var a = el('a', 'tk-brow');
    a.href = '/blog/post.html?id=' + encodeURIComponent(p.id);
    if (p.thumb) {
      var img = document.createElement('img');
      img.className = 'tk-bthumb';
      img.src = p.thumb;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      a.appendChild(img);
    } else {
      var ph = el('div', 'tk-bthumb ph');
      ph.appendChild(TK.ballMark(40));
      a.appendChild(ph);
    }
    var body = el('div', 'tk-bbody');
    body.appendChild(el('div', 'tk-btitle', p.title));
    var meta = el('div', 'tk-bmeta');
    meta.appendChild(el('span', 'date', TK.fmtDate(p.date)));
    meta.appendChild(el('span', 'who', p.author.name));
    body.appendChild(meta);
    a.appendChild(body);
    li.appendChild(a);
    return li;
  };

  // カード（最初の画面の2列表示。アイコンはトップページのメンバー欄の背番号を丸く切り取った形）
  TK.card = function (p) {
    var li = el('li');
    var a = el('a', 'tk-card');
    a.href = '/blog/post.html?id=' + encodeURIComponent(p.id);
    var who = el('div', 'tk-card-who');
    who.appendChild(el('span', 'tk-card-av', String(p.author.no)));
    who.appendChild(el('span', 'tk-card-name', p.author.name));
    a.appendChild(who);
    if (p.thumb) {
      var img = document.createElement('img');
      img.className = 'tk-card-img';
      img.src = p.thumb;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      a.appendChild(img);
    } else {
      var ph = el('div', 'tk-card-ph');
      ph.appendChild(TK.ballMark(64));
      a.appendChild(ph);
    }
    a.appendChild(el('div', 'tk-card-title', p.title));
    a.appendChild(el('div', 'tk-card-date', TK.fmtDate(p.date).replace(/\./g, '/')));
    li.appendChild(a);
    return li;
  };

  // ヘッダーのMENU（トップページと同じ動き）
  (function initMenu() {
    var menu = document.getElementById('tk-menu');
    var openBtn = document.getElementById('tk-menu-open');
    var closeBtn = document.getElementById('tk-menu-close');
    if (!menu || !openBtn || !closeBtn) return;
    function setOpen(open) {
      menu.hidden = !open;
      openBtn.setAttribute('aria-expanded', String(open));
      document.documentElement.style.overflow = open ? 'hidden' : '';
      (open ? closeBtn : openBtn).focus();
    }
    openBtn.addEventListener('click', function () { setOpen(true); });
    closeBtn.addEventListener('click', function () { setOpen(false); });
    menu.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setOpen(false); });
  })();

  TK.api = function (path, body) {
    var opts = body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' };
    return fetch('/api/blog/' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var e = new Error(data.error || '通信がうまくいきませんでした');
          e.status = r.status;
          throw e;
        }
        return data;
      });
    });
  };

  // localStorage は使えない環境もあるので必ず try で包む
  TK.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
})();
