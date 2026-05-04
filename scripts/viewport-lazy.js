(function () {
  const TRANSPARENT_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const ROOT_MARGIN = '240px 0px';
  const rootObservers = new WeakMap();
  let viewportObserver = null;

  function loadImage(img) {
    if (!img) return;

    const src = img.getAttribute('data-lazy-src');
    const srcset = img.getAttribute('data-lazy-srcset');

    if (src) img.src = src;
    if (srcset) img.srcset = srcset;

    img.removeAttribute('data-lazy-src');
    img.removeAttribute('data-lazy-srcset');
    img.removeAttribute('data-lazy-pending');
  }

  function onIntersect(entries, observer) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      loadImage(entry.target);
    });
  }

  function getObserver(root) {
    if (!('IntersectionObserver' in window)) return null;

    if (!root) {
      if (!viewportObserver) {
        viewportObserver = new IntersectionObserver(onIntersect, {
          root: null,
          rootMargin: ROOT_MARGIN,
          threshold: 0.01
        });
      }
      return viewportObserver;
    }

    let observer = rootObservers.get(root);
    if (!observer) {
      observer = new IntersectionObserver(onIntersect, {
        root,
        rootMargin: ROOT_MARGIN,
        threshold: 0.01
      });
      rootObservers.set(root, observer);
    }
    return observer;
  }

  function observe(img, options) {
    const settings = options || {};
    if (!img) return img;

    if (settings.src) img.setAttribute('data-lazy-src', settings.src);
    if (settings.srcset) img.setAttribute('data-lazy-srcset', settings.srcset);

    if (!img.getAttribute('data-lazy-src') && !img.getAttribute('data-lazy-srcset')) {
      return img;
    }

    if (!img.hasAttribute('loading')) img.loading = 'lazy';
    if (!img.hasAttribute('decoding')) img.decoding = 'async';
    if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
    if (!img.hasAttribute('src')) img.src = TRANSPARENT_PIXEL;
    img.setAttribute('data-lazy-pending', 'true');

    const observer = getObserver(settings.root || null);
    if (!observer) {
      loadImage(img);
      return img;
    }

    observer.observe(img);
    return img;
  }

  function hydrate(root, options) {
    const scope = root || document;
    const settings = options || {};
    scope
      .querySelectorAll('img[data-lazy-src], img[data-lazy-srcset]')
      .forEach((img) => observe(img, settings));
  }

  window.viewportLazy = {
    hydrate,
    load: loadImage,
    observe,
    placeholder: TRANSPARENT_PIXEL
  };

  document.addEventListener('DOMContentLoaded', function () {
    hydrate(document);
  });
})();
