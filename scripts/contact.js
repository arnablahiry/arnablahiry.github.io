document.addEventListener('DOMContentLoaded', () => {
  // Configuration: set the current winning location here (easy to change)
  // Valid ids: 'kolkata', 'heraklion', 'paris', 'world'
  const WINNER = 'paris';

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

  document.querySelectorAll('.contact-card').forEach(card => {
    const btn = card.querySelector('.contact-btn');
    const detailsEl = card.querySelector('.details-text');
    const closeBtn = card.querySelector('.contact-close');

    function openCard() {
      // close any other open cards and clear any wrong timers
      document.querySelectorAll('.contact-card').forEach(other => {
        if (other !== card) {
          other.classList.remove('revealed');
          other.classList.remove('wrong');
          const det = other.querySelector('.contact-details');
          if (det) det.setAttribute('aria-hidden', 'true');
          if (other._wrongTimer) { clearTimeout(other._wrongTimer); other._wrongTimer = null; }
        }
      });

      // If this card is not the winner, show temporary wrong message
      const id = card.dataset.id || '';
      if (id !== WINNER) {
          card.classList.add('wrong');
          const detEl = card.querySelector('.contact-details');
          if (detEl) {
            const txt = detEl.querySelector('.details-text');
            if (txt) txt.textContent = MESSAGES.wrong;
            detEl.setAttribute('aria-hidden', 'false');
          }
        // hide after a short delay
        card._wrongTimer = setTimeout(() => {
          card.classList.remove('wrong');
          const detEl2 = card.querySelector('.contact-details');
          if (detEl2) detEl2.setAttribute('aria-hidden', 'true');
          card._wrongTimer = null;
        }, 1400);
        return;
      }

      // build details text from data attributes for the winner
  const addr = card.dataset.address || '';
  const e1 = card.dataset.email1 || '';
  const e2 = card.dataset.email2 || '';
  const phone = card.dataset.phone || '';

  // Build HTML: 'Correct!' label, address (preserve line breaks), emails as mailto links, phone as tel link
  const addrHtml = addr ? `<div class="addr">${addr.replace(/\n/g, '<br/>')}</div>` : '';
  const emailParts = [];
  if (e1) emailParts.push(`<a href="mailto:${e1}">${e1}</a>`);
  if (e2) emailParts.push(`<a href="mailto:${e2}">${e2}</a>`);
  if (phone) emailParts.push(`<a href="tel:${phone}">${phone}</a>`);
  const emailsHtml = emailParts.length ? `<div class="contact-links">${emailParts.join('<br/>')}</div>` : '';

  detailsEl.innerHTML = `<div class="correct">${MESSAGES.correct}</div>${addrHtml}${emailsHtml}`;

      card.classList.add('revealed');
      const detEl = card.querySelector('.contact-details');
      if (detEl) detEl.setAttribute('aria-hidden', 'false');
    }

    function closeCard() {
      card.classList.remove('revealed');
      const det = card.querySelector('.contact-details');
      if (det) det.setAttribute('aria-hidden', 'true');
    }

    btn.addEventListener('click', (e) => {
      // toggle revealed state
      if (card.classList.contains('revealed')) {
        closeCard();
      } else {
        openCard();
      }
    });

    // keyboard support (Enter / Space) on the div acting as a button
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (card.classList.contains('revealed')) closeCard(); else openCard();
      }
    });

    // allow closing by clicking the details area when revealed
    const detailsContainer = card.querySelector('.contact-details');
    detailsContainer.addEventListener('click', (e) => {
      closeCard();
    });

    // close button handling (stop propagation so it doesn't re-open)
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCard();
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


