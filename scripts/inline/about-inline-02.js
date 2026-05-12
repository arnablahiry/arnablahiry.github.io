// About photo lightbox: match the Travel page modal animation exactly.
(function(){
  const lightboxEl = document.getElementById('lightbox');
  if(!lightboxEl) return;

  const lightboxImgEl = lightboxEl.querySelector('.lightbox-image');
  const lightboxCaptionEl = lightboxEl.querySelector('.lightbox-caption');
  const closeBtn = lightboxEl.querySelector('.lightbox-close');

  function isLocalAboutImageLink(anchor){
    const href = anchor && anchor.getAttribute('href');
    return !!(href && /^images\/about\//.test(href));
  }

  function getCaption(anchor){
    if(!anchor) return '';
    const label = anchor.getAttribute('aria-label') || '';
    if(label) return label.replace(/^Open\s+/i, '').trim();
    const img = anchor.querySelector('img');
    return img ? (img.getAttribute('alt') || '') : '';
  }

  function openLightbox(anchor){
    if(!lightboxImgEl || !anchor) return;
    const src = anchor.getAttribute('href');
    if(!src) return;

    const img = anchor.querySelector('img');
    lightboxImgEl.src = src;
    lightboxImgEl.alt = img ? (img.getAttribute('alt') || '') : '';
    if(lightboxCaptionEl) lightboxCaptionEl.textContent = getCaption(anchor);

    lightboxEl.classList.remove('closing');
    lightboxEl.classList.remove('open');
    void lightboxEl.offsetWidth;
    lightboxEl.classList.add('open');
    lightboxEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('travel-lightbox-open');
  }

  function closeLightbox(){
    if(lightboxEl.classList.contains('closing')) return;

    const finalize = () => {
      lightboxEl.classList.remove('open');
      lightboxEl.classList.remove('closing');
      lightboxEl.setAttribute('aria-hidden', 'true');
      if(lightboxImgEl) {
        lightboxImgEl.src = '';
        lightboxImgEl.alt = '';
      }
      if(lightboxCaptionEl) lightboxCaptionEl.textContent = '';
      document.body.classList.remove('travel-lightbox-open');
    };

    const onEnd = (event) => {
      if(event && event.target !== lightboxEl) return;
      if(event && event.animationName !== 'travel-lightbox-backdrop-out') return;
      lightboxEl.removeEventListener('animationend', onEnd);
      finalize();
    };

    lightboxEl.addEventListener('animationend', onEnd);
    lightboxEl.classList.remove('open');
    lightboxEl.classList.add('closing');
    setTimeout(() => {
      lightboxEl.removeEventListener('animationend', onEnd);
      if(lightboxEl.classList.contains('closing')) finalize();
    }, 280);
  }

  document.addEventListener('click', function(event){
    const anchor = event.target.closest('.about-photo-grid .about-thumb, .about-mini-banner .about-thumb');
    if(!anchor || !isLocalAboutImageLink(anchor)) return;
    event.preventDefault();
    openLightbox(anchor);
  });

  lightboxEl.addEventListener('click', function(event){
    if(event.target === lightboxEl) closeLightbox();
  });

  if(closeBtn) {
    closeBtn.addEventListener('click', closeLightbox);
    closeBtn.addEventListener('click', (event) => event.stopPropagation());
  }

  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape' && lightboxEl.classList.contains('open')) {
      closeLightbox();
    }
  });
})();
