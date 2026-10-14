document.addEventListener('DOMContentLoaded', () => {
  // If you have a server endpoint to receive contact form submissions, set it here.
  // Example (Formspree): 'https://formspree.io/f/yourFormId'
  // Example (custom API): 'https://example.com/api/contact'
  // Leave empty to fall back to opening the user's email client.
  const CONTACT_ENDPOINT = 'https://formspree.io/f/myzozydb';

  // Localizable/overridable messages
  const MESSAGES = {
    wrong: 'Wrong! try again T_T',
    correct: 'Correct!'
  };

  // Card details and dates: scripts/contact-places.js (edited with the site
  // editor). Which card is right is worked out at each click, so it follows
  // the calendar even if the page stays open over midnight.
  const DATA = window.CONTACT_PLACES || { fallback: '', cards: {} };

  const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Today's date as YYYY-MM-DD in a time zone (empty: the visitor's own)
  function todayIn(tz) {
    let parts;
    try {
      parts = new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    } catch (_) {
      parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    }
    const get = (type) => (parts.find((p) => p.type === type) || {}).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  // "2026-10-14" -> "14 Oct 2026"
  function formatDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  }

  function hasDates(card) { return !!(card && (card.from || card.to)); }

  // Does the card's date range include today (in the card's time zone)?
  function isHereToday(card) {
    if (!hasDates(card)) return false;
    const today = todayIn(card.tz);
    return (!card.from || card.from <= today) && (!card.to || today <= card.to);
  }

  // The right card(s) today: those whose dates include today, or else the fallback
  function correctIds(data) {
    const cards = (data || DATA).cards || {};
    const here = Object.keys(cards).filter((id) => isHereToday(cards[id]));
    return here.length ? here : [(data || DATA).fallback];
  }

  // "(Will be there from 14 Oct 2026 to 20 Oct 2026)", or "Was there" once it's over
  function datesHtml(card) {
    if (!hasDates(card)) return '';
    const past = card.to && card.to < todayIn(card.tz);
    const verb = past ? 'Was there' : 'Will be there';
    const b = (iso) => `<strong>${escapeHtml(formatDate(iso))}</strong>`;
    let range;
    if (card.from && card.to) range = card.from === card.to ? `on ${b(card.from)}` : `from ${b(card.from)} to ${b(card.to)}`;
    else if (card.from) range = `from ${b(card.from)}`;
    else range = `until ${b(card.to)}`;
    return `<div class="wrong-dates">(${verb} ${range})</div>`;
  }

  function detailsHtml(card) {
    const note = escapeHtml(card.note);
    const address = escapeHtml(card.address);
    const map = /^https?:\/\//i.test(card.map || '') ? escapeHtml(card.map) : '';
    const addressPart = address && map ? `<a href="${map}" target="_blank" rel="noopener">${address}</a>` : address;
    const addr = [note, addressPart].filter(Boolean).join('\n\n');
    const links = [];
    [card.email1, card.email2].filter(Boolean).forEach((e) => links.push(`<a href="mailto:${escapeHtml(e)}">${escapeHtml(e)}</a>`));
    if (card.phone) links.push(`<a href="tel:${escapeHtml(card.phone.replace(/[^\d+]/g, ''))}">${escapeHtml(card.phone)}</a>`);
    return `<div class="correct">${MESSAGES.correct}</div>`
      + (addr ? `<div class="addr">${addr}</div>` : '')
      + (links.length ? `<div class="contact-links">${links.join('<br/>')}</div>` : '');
  }

  const cardEls = Array.from(document.querySelectorAll('.contact-card'));

  function closeCard(cardEl) {
    cardEl.classList.remove('revealed', 'wrong');
    const det = cardEl.querySelector('.contact-details');
    if (det) det.setAttribute('aria-hidden', 'true');
  }

  function openCard(cardEl) {
    cardEls.forEach((other) => { if (other !== cardEl) closeCard(other); });
    const id = cardEl.dataset.id || '';
    const card = (DATA.cards || {})[id] || {};
    const detEl = cardEl.querySelector('.contact-details');
    const textEl = cardEl.querySelector('.details-text');

    if (correctIds().indexOf(id) === -1) {
      // stays up until its x is pressed
      textEl.innerHTML = `<div class="wrong-text">${escapeHtml(MESSAGES.wrong)}</div>${datesHtml(card)}`;
      cardEl.classList.remove('revealed');
      cardEl.classList.remove('wrong');
      void cardEl.offsetWidth;   // replay the shake on a repeat click
      cardEl.classList.add('wrong');
    } else {
      textEl.innerHTML = detailsHtml(card);
      cardEl.classList.add('revealed');
    }
    if (detEl) detEl.setAttribute('aria-hidden', 'false');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented) cardEls.forEach(closeCard);
  });

  // For the contact editor (scripts/contact-edit.js)
  window.ContactPage = { todayIn, formatDate, isHereToday, correctIds, closeAll: () => cardEls.forEach(closeCard) };

  cardEls.forEach((cardEl) => {
    const btn = cardEl.querySelector('.contact-btn');
    const toggle = () => {
      if (cardEl.classList.contains('revealed') || cardEl.classList.contains('wrong')) closeCard(cardEl);
      else openCard(cardEl);
    };
    btn.addEventListener('click', toggle);
    // keyboard support (Enter / Space) on the div acting as a button
    btn.addEventListener('keydown', (e) => {
      if (e.target !== btn) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    // clicks inside the open pane (selecting text, links) leave it open
    cardEl.querySelector('.contact-details').addEventListener('click', (e) => e.stopPropagation());
    const closeBtn = cardEl.querySelector('.contact-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCard(cardEl);
        btn.focus();
      });
    }
  });

  // Contact form handling (simple client-side feedback)
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const msgEl = contactForm.querySelector('.form-msg');
    const submitBtn = contactForm.querySelector('.btn-submit');
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn) submitBtn.disabled = true;
      const name = (contactForm.elements['name'] || {}).value || '';
      const email = (contactForm.elements['email'] || {}).value || '';
      const message = (contactForm.elements['message'] || {}).value || '';
      // basic validation
      if (!name.trim() || !email.trim() || !message.trim()) {
        if (msgEl) { msgEl.textContent = 'Please fill name, email and message.'; msgEl.classList.remove('success'); msgEl.classList.add('error'); }
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const to = 'alahiry@ics.forth.gr';
      const subj = (contactForm.elements['subject'] || {}).value || 'Message from website';

      // If a CONTACT_ENDPOINT is configured, POST the data there. Support both Formspree (form endpoint)
      // and generic JSON APIs. Otherwise fall back to mailto behavior.
      if (CONTACT_ENDPOINT && CONTACT_ENDPOINT.trim().length > 0) {
        try {
          if (msgEl) { msgEl.textContent = 'Sending...'; msgEl.classList.remove('error','success'); }

          let resp;
          // Formspree endpoints typically accept form-encoded data. Detect by hostname pattern.
          const isFormspree = CONTACT_ENDPOINT.includes('formspree.io');
          if (isFormspree) {
            const fd = new FormData();
            fd.append('name', name);
            fd.append('email', email);
            fd.append('_replyto', email);
            fd.append('subject', subj);
            fd.append('message', message);
            // Formspree supports CORS; request JSON response by requesting Accept: application/json.
            resp = await fetch(CONTACT_ENDPOINT, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' }, mode: 'cors' });
          } else {
            const payload = { to, name, email, subject: subj, message };
            resp = await fetch(CONTACT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          }

          if (resp && resp.ok) {
            if (msgEl) { msgEl.textContent = 'Thanks — your message has been sent.'; msgEl.classList.remove('error'); msgEl.classList.add('success'); }
            contactForm.reset();
          } else {
            const text = resp && typeof resp.text === 'function' ? await resp.text() : '';
            if (msgEl) { msgEl.textContent = `Submission failed${text ? ': '+text : ''}`; msgEl.classList.remove('success'); msgEl.classList.add('error'); }
          }
        } catch (err) {
          // Show a helpful message and automatically fall back to mailto: so user can still send the message.
          console.error('Contact form send error:', err);
          if (msgEl) {
            msgEl.innerHTML = 'Network error while sending message. Falling back to opening your email client.\nPlease check your CONTACT_ENDPOINT or CORS settings.';
            msgEl.classList.remove('success');
            msgEl.classList.add('error');
          }
          // Attempt mailto fallback so the user can still send their message
          try {
            const bodyRawFb = `${message}\r\n\r\n${name}\r\n${email}`;
            const mailtoFb = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(bodyRawFb)}`;
            window.location.href = mailtoFb;
          } catch (err2) {
            console.error('Mailto fallback failed:', err2);
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
        return;
      }

      // No CONTACT_ENDPOINT configured: fall back to opening mail client but notify the user.
      if (msgEl) { msgEl.textContent = 'No server endpoint configured — opening your email client as fallback.'; msgEl.classList.remove('error'); msgEl.classList.add('success'); }
      const bodyRaw = `${message}\r\n\r\n${name}\r\n${email}`;
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(bodyRaw)}`;
      window.location.href = mailto;
      setTimeout(() => { if (submitBtn) submitBtn.disabled = false; }, 900);
    });
  }
});


