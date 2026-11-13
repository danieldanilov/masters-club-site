// My profile: what others see, the photo, and the choices about being shown.
(function () {
  var $ = App.$, esc = App.esc, state = App.state, page = App.page, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, cohortLabel = Core.cohortLabel;

  function pageMe() {
    var u = state.me;
    var p = u.profile;
    var first = u.first;
    var opt = function (list, val) { return list.map(function (i) { return '<option ' + (val === i ? 'selected' : '') + '>' + esc(i) + '</option>'; }).join(''); };
    return page('<div class="page-head"><h1>' + (!first ? 'Edit your profile' : u.hasProfile ? 'Welcome. Check your profile' : 'Welcome. Fill in your profile') + '</h1></div>' +
      (first ? '<p class="lead measure">' + (u.hasProfile ? 'We filled this in from your application. Fix anything that\'s off, and save.' : 'This is how other members find you. It takes a minute, and you can change it any time.') + ' <a class="link" href="members">Skip for now</a></p>' : '') +
      '<div class="two mt-4"><form class="form-grid cols" id="profileForm" novalidate>' +
      // Photos come only from uploads, so a first visit without one asks for it up front (F106).
      '<div class="photo-row"><span id="myPhoto">' + App.avatar(u, 'lg') + '</span><div class="row-actions"><label class="btn ' + (first && !p.photo ? 'gold' : 'quiet') + ' small file-btn">' + (p.photo ? 'Change photo' : 'Add a photo') + '<input type="file" accept="image/*" aria-label="Choose a photo" class="ph-no-capture"></label>' +
      (p.photo ? '<button class="link" type="button" id="removePhoto">Remove photo</button>' : '') + (first && !p.photo ? '<span class="muted small">Add one so people recognise you at meetings.</span>' : '') + '</div></div>' +
      '<label>Name<input type="text" name="name" value="' + esc(u.name) + '" maxlength="60" required dir="auto"><span class="field-error" data-err="name"></span></label>' +
      '<label>Role<input type="text" name="role" value="' + esc(p.role) + '" maxlength="60" dir="auto" placeholder="Product Manager"><span class="field-error" data-err="role"></span></label>' +
      '<label>Company<input type="text" name="company" value="' + esc(p.company) + '" maxlength="60" dir="auto" placeholder="Where you work now"><span class="field-error" data-err="company"></span></label>' +
      '<label>City<input type="text" name="city" value="' + esc(p.city) + '" maxlength="60" dir="auto"><span class="field-error" data-err="city"></span></label>' +
      '<label>Program<input type="text" name="program" value="' + esc(p.program) + '" maxlength="100" dir="auto" placeholder="GMBA, Arison"><span class="field-error" data-err="program"></span></label>' +
      '<label>Industry<select name="industry"><option value="">Choose one</option>' + opt(Core.INDUSTRIES, p.industry) + '</select><span class="field-error" data-err="industry"></span></label>' +
      '<label>Cohort <span class="hint">Set by leaders</span><input type="text" value="' + esc(cohortLabel(u.cohort)) + '" disabled></label>' +
      '<label>I can help with <span class="hint">Separate with commas, up to 6</span><input type="text" name="help" value="' + esc(p.help.join(', ')) + '" maxlength="250" dir="auto" placeholder="PM interviews, fundraising"><span class="field-error" data-err="help"></span></label>' +
      '<label>I\'m looking for <span class="hint">Separate with commas, up to 6</span><input type="text" name="looking" value="' + esc(p.looking.join(', ')) + '" maxlength="250" dir="auto" placeholder="Co-founder, PM roles"><span class="field-error" data-err="looking"></span></label>' +
      '<label>Outside work <span class="hint">Hobbies and interests, separated with commas</span><input type="text" name="interests" value="' + esc(p.interests.join(', ')) + '" maxlength="250" dir="auto" placeholder="Running, chess, cooking"><span class="field-error" data-err="interests"></span></label>' +
      '<div class="field">Open to<div class="checks">' + Core.OPEN_TO.map(function (o) { return '<label><input type="checkbox" name="open_to" value="' + esc(o) + '" ' + (p.open_to.indexOf(o) !== -1 ? 'checked' : '') + '> ' + esc(o) + '</label>'; }).join('') + '</div></div>' +
      '<label>Short bio <span class="hint">Up to 280 characters</span><textarea name="bio" maxlength="280" rows="3" dir="auto">' + esc(p.bio) + '</textarea><span class="field-error" data-err="bio"></span></label>' +
      '<label>LinkedIn URL<input type="url" name="linkedin" value="' + esc(p.linkedin) + '" placeholder="https://www.linkedin.com/in/..."><span class="field-error" data-err="linkedin"></span></label>' +
      '<label>WhatsApp number <span class="hint">Optional, with the country code</span><input type="tel" name="phone" value="' + esc(p.phone) + '" placeholder="+972..."><span class="field-error" data-err="phone"></span></label>' +
      '<label class="check-line"><input type="checkbox" name="show_phone" ' + (p.show_phone ? 'checked' : '') + '> Show a WhatsApp button on my profile</label>' +
      '<label class="check-line"><input type="checkbox" name="show_email" ' + (p.show_email ? 'checked' : '') + '> Show my email <span class="ph-sensitive">(' + esc(u.email) + ')</span> on my profile</label>' +
      '<label class="check-line"><input type="checkbox" name="hidden" ' + (p.hidden ? 'checked' : '') + '> Hide me from the directory</label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Save profile</button></div>' +
      '</form><div class="sticky"><div class="preview-label">How others see you</div><div class="preview panel mist tied"><div class="sheet" id="preview"></div></div></div></div>');
  }

  function readProfileForm(f) {
    var fd = new FormData(f);
    return {
      name: String(fd.get('name') || ''),
      profile: {
        role: fd.get('role'), company: fd.get('company'), city: fd.get('city'), program: fd.get('program'), industry: fd.get('industry'),
        help: fd.get('help'), looking: fd.get('looking'), interests: fd.get('interests'), open_to: fd.getAll('open_to'),
        bio: fd.get('bio'), linkedin: fd.get('linkedin'), phone: fd.get('phone'), show_phone: !!fd.get('show_phone'), show_email: !!fd.get('show_email'), hidden: !!fd.get('hidden')
      }
    };
  }

  function wireMe() {
    var f = $('#profileForm');
    var u = state.me;
    // Built by the same function the server uses for the directory, so it shows exactly what others will see.
    function preview() {
      var r = readProfileForm(f);
      var v = Core.validateProfile(r.profile).value;
      v.photo = u.profile.photo;
      var entry = Core.directoryEntry({ id: u.id, name: r.name || u.name, tier: u.tier, cohort: u.cohort, email: u.email, joined_on: 'yes' }, v, false);
      $('#preview').innerHTML = App.profileSheet(entry, true);
    }
    f.addEventListener('input', preview);
    preview();
    wirePhoto();
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(f);
      var r = readProfileForm(f);
      var check = Core.validateProfile(r.profile);
      var nameCheck = Core.validateName(r.name);
      var errs = check.errors;
      if (!nameCheck.ok) errs.name = nameCheck.error;
      if (Object.keys(errs).length) return showErrors(f, { message: 'Some fields need fixing', fields: errs });
      var btn = $('button[type=submit]', f);
      setBusy(btn, true);
      try {
        var res = await Api.call('saveProfile', r);
        Analytics.track('profile updated', profileFacts(u, check.value));
        state.me = res.me;
        toast('Profile saved');
        await App.refresh();
        go('members');
      } catch (err) {
        setBusy(btn, false);
        if (err.code !== 'unauthorized') showErrors(f, err);
        else App.render();
      }
    });
  }

  // What a save says about a profile, without a word of what's in it.
  function profileFacts(u, v) {
    var filled = ['role', 'company', 'city', 'program', 'industry', 'help', 'looking', 'interests', 'open_to', 'bio', 'linkedin', 'phone']
      .filter(function (k) { return Array.isArray(v[k]) ? v[k].length : !!v[k]; }).length;
    return { first_time: !!u.first, fields_filled: filled, has_photo: !!u.profile.photo, show_phone: !!v.show_phone, show_email: !!v.show_email, hidden: !!v.hidden };
  }

  // Crops to a square and shrinks to a small JPEG in the browser, so the file's original size,
  // format and location data never leave the phone.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      var img = new Image();
      img.onload = function () {
        var box = Core.cropSquare(img.naturalWidth, img.naturalHeight);
        var c = document.createElement('canvas');
        c.width = c.height = 256;
        c.getContext('2d').drawImage(img, box.x, box.y, box.side, box.side, 0, 0, 256, 256);
        var q = 0.8;
        var data = c.toDataURL('image/jpeg', q);
        while (data.length > 40000 && q > 0.3) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
        resolve(data);
      };
      img.onerror = reader.onerror = function () { reject(new Error("That file doesn't look like a photo.")); };
      reader.onload = function () { img.src = reader.result; };
      reader.readAsDataURL(file);
    });
  }

  function wirePhoto() {
    var input = $('.file-btn input');
    input.addEventListener('change', async function () {
      if (!input.files[0]) return;
      try {
        var data = await shrink(input.files[0]);
        var r = await Api.call('savePhoto', { data: data });
        Analytics.track('photo uploaded');
        state.me = r.me;
        App.photoCache()[r.me.id] = { v: r.me.profile.photo, data: data };
        App.writeJson('localStorage', App.PHOTOS_KEY, App.photoCache());
        toast('Photo saved');
        App.render();
        App.refresh().catch(function () {});
      } catch (e) { toast(e.message); }
    });
    var remove = $('#removePhoto');
    if (remove) remove.addEventListener('click', async function () {
      try {
        var r = await Api.call('removePhoto');
        Analytics.track('photo removed');
        state.me = r.me;
        toast('Photo removed');
        App.render();
        App.refresh().catch(function () {});
      } catch (e) { toast(e.message); }
    });
  }

  App.route('me', { page: pageMe, wire: wireMe, member: true });
})();
