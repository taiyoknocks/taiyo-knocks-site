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

  // 一覧の1行
  TK.listRow = function (p) {
    var li = el('li');
    var a = el('a', 'tk-row');
    a.href = '/blog/post.html?id=' + encodeURIComponent(p.id);
    if (p.thumb) {
      var img = document.createElement('img');
      img.className = 'tk-thumb';
      img.src = p.thumb;
      img.alt = '';
      img.loading = 'lazy';
      a.appendChild(img);
    } else {
      a.appendChild(el('div', 'tk-thumb-ph', String(p.author.no)));
    }
    var body = el('div', 'tk-row-body');
    var meta = el('div', 'tk-row-meta');
    meta.appendChild(el('span', 'date', TK.fmtDate(p.date, false)));
    meta.appendChild(el('span', 'who', p.author.no + ' ' + p.author.name));
    body.appendChild(meta);
    body.appendChild(el('div', 'tk-row-title', p.title));
    if (p.excerpt) body.appendChild(el('div', 'tk-row-ex', p.excerpt));
    a.appendChild(body);
    li.appendChild(a);
    return li;
  };

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
