// The board: jobs, opportunities, asks and resources. Searchable here, shared to WhatsApp in a tap.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, TIER_LABEL = Core.TIER_LABEL, cohortLabel = Core.cohortLabel;

  var PLURAL = { job: 'Jobs', opportunity: 'Opportunities', ask: 'Asks', resource: 'Resources', partner: 'From partners' };

  function pageBoard() {
    return page('<div class="page-head"><h1>Board</h1><span class="count" id="boardCount"></span><span class="spacer"></span><a class="link" href="post-edit">Post something</a></div>' +
      '<div class="search-row">' + App.icon('search') + '<label class="sr-only" for="boardQ">Search the board</label><input class="search" type="search" id="boardQ" aria-label="Search the board" placeholder="Search jobs, companies, anything" value="' + esc(state.board.q) + '" dir="auto" autocomplete="off"></div>' +
      '<div class="filters" id="boardKinds"></div><div id="boardList"></div>');
  }

  function postText(p) {
    return [p.title, p.company, p.location, p.body, Core.POST_KINDS[p.kind], p.author.name].join(' \n ').toLowerCase();
  }

  function postHtml(p) {
    var link = App.siteLink('board?p=' + p.id);
    var share = (Core.POST_KINDS[p.kind] || '') + ': ' + p.title + '\n' + link;
    var closed = p.status !== 'open' || p.expired;
    return '<article class="post" data-post="' + esc(p.id) + '" id="p-' + esc(p.id) + '"><div class="tags"><span class="tag">' + esc(Core.POST_KINDS[p.kind] || p.kind) + '</span>' +
      (p.status !== 'open' ? '<span class="tag unjoined">Closed</span>' : p.expired ? '<span class="tag unjoined">Expired</span>' : '') + '</div>' +
      '<h2 class="title ph-sensitive" dir="auto">' + esc(p.title) + '</h2>' +
      (p.company || p.location ? '<p class="muted ph-sensitive" dir="auto">' + esc([p.company, p.location].filter(Boolean).join(', ')) + '</p>' : '') +
      (p.body ? '<p class="details ph-sensitive" dir="auto">' + esc(p.body) + '</p>' : '') +
      (p.contact ? '<p dir="auto"><b>Contact:</b> <span class="ph-sensitive">' + esc(p.contact) + '</span></p>' : '') +
      '<p class="muted small">Posted by <a class="person-link" href="members?m=' + esc(p.author.id) + '" dir="auto">' + esc(p.author.name) + '</a> on ' + esc(Core.shortDate(new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: Core.TIME_ZONE }))) + '</p>' +
      '<div class="row-actions">' + (p.link ? '<a class="btn quiet small" href="' + esc(p.link) + '" target="_blank" rel="noopener">Open the link</a>' : '') +
      '<a class="btn quiet small" href="' + esc(Core.whatsappUrl(share)) + '" target="_blank" rel="noopener" data-share>Share on WhatsApp</a>' +
      (p.can_edit ? '<a class="link" href="post-edit?p=' + esc(p.id) + '">Edit</a><button class="link" data-close-post>' + (closed ? 'Bring it back' : 'Close it') + '</button>' : '') + '</div></article>';
  }

  function drawBoard() {
    if (!$('#boardList')) return;
    var s = state.board;
    var posts = state.data.posts;
    var kinds = Object.keys(Core.POST_KINDS).filter(function (k) { return posts.some(function (p) { return p.kind === k; }); });
    $('#boardKinds').innerHTML = kinds.length > 1 ? '<button class="chip ' + (!s.kind ? 'on' : '') + '" data-kind="">All</button>' + kinds.map(function (k) {
      return '<button class="chip ' + (s.kind === k ? 'on' : '') + '" data-kind="' + k + '">' + esc(PLURAL[k] || k) + '</button>';
    }).join('') : '';
    var words = s.q.toLowerCase().split(/\s+/).filter(Boolean);
    var list = posts.filter(function (p) {
      if (s.kind && p.kind !== s.kind) return false;
      var text = postText(p);
      return words.every(function (w) { return text.indexOf(w) !== -1; });
    });
    $('#boardCount').textContent = list.length + (list.length === 1 ? ' post' : ' posts');
    $('#boardList').innerHTML = list.length ? list.map(postHtml).join('') : '<div class="empty">' + (posts.length ? 'Nothing matches. Try fewer words.' : 'Nothing here yet. Hiring, or looking for something? Post it, and share it to WhatsApp from here.') + '</div>';
    $$('[data-kind]').forEach(function (b) { b.addEventListener('click', function () { s.kind = b.dataset.kind; drawBoard(); }); });
    $$('[data-share]').forEach(function (a) {
      a.addEventListener('click', function () { Analytics.track('post shared', { post_id: a.closest('[data-post]').dataset.post }); });
    });
    $$('[data-close-post]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.closest('[data-post]').dataset.post;
        var p = state.data.posts.filter(function (x) { return x.id === id; })[0];
        setBusy(b, true, 'One moment…');
        try {
          var reopen = p.status !== 'open' || p.expired;
          var r = await Api.call('postClose', { id: id, reopen: reopen });
          Analytics.track(reopen ? 'post reopened' : 'post closed', { post_id: id, kind: p.kind });
          App.replaceItem('posts', r.post);
          drawBoard();
        } catch (err) { setBusy(b, false); toast(err.message); }
      });
    });
  }

  function wireBoard(params) {
    // Once someone stops typing: how many posts they found, never the words.
    $('#boardQ').addEventListener('input', function (e) {
      state.board.q = e.target.value;
      drawBoard();
      clearTimeout(wireBoard.timer);
      wireBoard.timer = setTimeout(function () {
        if (state.board.q.trim()) Analytics.track('board searched', { result_count: $$('[data-post]').length, kind: state.board.kind || 'all' });
      }, 800);
    });
    drawBoard();
    var target = params.get('p') && document.getElementById('p-' + params.get('p'));
    if (target) { target.scrollIntoView(); target.classList.add('hit'); return 'keep-scroll'; }
  }

  function pageEdit(params) {
    var id = params.get('p');
    var p = id ? state.data.posts.filter(function (x) { return x.id === id; })[0] : { kind: 'job', audience: 'all' };
    if (!p) return page('<div class="note warn">This post isn\'t here.</div>');
    var leader = state.me.tier === 'leader';
    var v = function (k) { return esc(p[k] || ''); };
    var kinds = Object.keys(Core.POST_KINDS).filter(function (k) { return Core.canPostKind(k, state.me.tier); });
    var cohorts = Array.from(new Set(state.data.directory.members.map(function (m) { return m.cohort; }).filter(Boolean))).sort();
    var audiences = leader ? [['all', 'Everyone'], ['club', 'Club'], ['community', 'Community']].concat(cohorts.map(function (c) { return ['cohort:' + c, cohortLabel(c)]; })) : [['all', 'Everyone'], [state.me.tier, TIER_LABEL[state.me.tier]]];
    return page('<p class="back"><a class="link" href="board">Back to the board</a></p><h1>' + (id ? 'Edit the post' : 'Post something') + '</h1>' +
      '<form class="form-grid event-form" id="postForm" novalidate style="margin-top:24px">' +
      '<div class="form-row"><label>What is it<select name="kind">' + kinds.map(function (k) { return '<option value="' + k + '" ' + (p.kind === k ? 'selected' : '') + '>' + esc(Core.POST_KINDS[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label>Who it\'s for<select name="audience">' + audiences.map(function (a) { return '<option value="' + esc(a[0]) + '" ' + (p.audience === a[0] ? 'selected' : '') + '>' + esc(a[1]) + '</option>'; }).join('') + '</select></label></div>' +
      '<label>Title<input type="text" name="title" value="' + v('title') + '" maxlength="120" required dir="auto"><span class="field-error" data-err="title"></span></label>' +
      '<div class="form-row"><label>Company <span class="hint">Optional</span><input type="text" name="company" value="' + v('company') + '" maxlength="60" dir="auto"><span class="field-error" data-err="company"></span></label>' +
      '<label>Where <span class="hint">Optional</span><input type="text" name="location" value="' + v('location') + '" maxlength="60" dir="auto"><span class="field-error" data-err="location"></span></label></div>' +
      '<label>Details<textarea name="body" rows="5" maxlength="2000" dir="auto">' + v('body') + '</textarea><span class="field-error" data-err="body"></span></label>' +
      '<label>Link <span class="hint">Optional</span><input type="url" name="link" value="' + v('link') + '" placeholder="https://..."><span class="field-error" data-err="link"></span></label>' +
      '<label>How to reach you <span class="hint">Optional. People can always find you through your profile</span><input type="text" name="contact" value="' + v('contact') + '" maxlength="120" dir="auto" placeholder="WhatsApp me for an intro"><span class="field-error" data-err="contact"></span></label>' +
      '<p class="muted small">Posts stay up for ' + Core.POST_DAYS + ' days. You can close one earlier, or bring it back.</p>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Post it</button></div></form>');
  }

  function wireEdit(params) {
    var f = $('#postForm');
    if (!f) return;
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      clearErrors(f);
      var input = {};
      new FormData(f).forEach(function (val, k) { input[k] = val; });
      if (params.get('p')) input.id = params.get('p');
      var check = Core.validatePost(input);
      if (!check.ok) return showErrors(f, { message: 'Some fields need fixing', fields: check.errors });
      var btn = $('button[type=submit]', f);
      setBusy(btn, true, 'Posting…');
      try {
        var r = await Api.call('postSave', { post: input });
        Analytics.track(input.id ? 'post updated' : 'post created', { post_id: r.post.id, kind: r.post.kind, audience: r.post.audience });
        App.replaceItem('posts', r.post);
        state.board.q = '';
        state.board.kind = '';
        toast('Posted');
        go('board');
      } catch (err) { setBusy(btn, false); showErrors(f, err); }
    });
  }

  // Leaders only for now, through the portal-board flag in PostHog: there are no job boards yet.
  App.route('board', { page: pageBoard, wire: wireBoard, member: true, onData: drawBoard, flag: 'portal-board' });
  App.route('post-edit', { page: pageEdit, wire: wireEdit, member: true, flag: 'portal-board' });
})();
