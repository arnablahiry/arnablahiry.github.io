document.addEventListener('DOMContentLoaded', () => {
  // Configuration: set the current winning location here (easy to change)
  // Valid ids: 'kolkata', 'heraklion', 'paris', 'world'
  const WINNER = 'heraklion';

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
});


