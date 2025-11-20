// Small helper to persist and apply background dimming preferences.
// Provides window.setBgImageOpacity(value) and window.setPageDimOpacity(value)
// Accepts a number between 0 and 1 (e.g. 0.2 -> 20% opaque).

(function(){
  const KEY_IMAGE = 'site:bg-image-opacity';
  const KEY_PAGE = 'site:page-dim-opacity';

  function applyFromStorage(){
    const storedImage = localStorage.getItem(KEY_IMAGE);
    const storedPage = localStorage.getItem(KEY_PAGE);
    if(storedImage !== null){
      document.documentElement.style.setProperty('--bg-image-opacity', storedImage);
    }
    if(storedPage !== null){
      document.documentElement.style.setProperty('--page-dim-opacity', storedPage);
    }
  }

  function setBgImageOpacity(v){
    const n = Number(v);
    if(Number.isFinite(n) && n >= 0 && n <= 1){
      document.documentElement.style.setProperty('--bg-image-opacity', String(n));
      localStorage.setItem(KEY_IMAGE, String(n));
      return true;
    }
    return false;
  }

  function setPageDimOpacity(v){
    const n = Number(v);
    if(Number.isFinite(n) && n >= 0 && n <= 1){
      document.documentElement.style.setProperty('--page-dim-opacity', String(n));
      localStorage.setItem(KEY_PAGE, String(n));
      return true;
    }
    return false;
  }

  // expose
  window.setBgImageOpacity = setBgImageOpacity;
  window.setPageDimOpacity = setPageDimOpacity;
  window.getBgOpacities = function(){
    return {
      image: getComputedStyle(document.documentElement).getPropertyValue('--bg-image-opacity').trim() || null,
      page: getComputedStyle(document.documentElement).getPropertyValue('--page-dim-opacity').trim() || null,
    };
  };

  // apply stored values at load
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyFromStorage);
  } else {
    applyFromStorage();
  }
})();
