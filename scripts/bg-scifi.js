(function () {
  try {
    var img = document.getElementById('bg-image');
    if (!img) return;
    var normal = img.getAttribute('src') || '';
    var scifi = normal.replace('_bg.jpeg', '_scifi.jpeg').replace('background.jpeg', 'background_scifi.jpeg');
    img.dataset.srcNormal = normal;
    img.dataset.srcScifi = scifi;
    if (localStorage.getItem('site:scifi') === 'on') {
      img.setAttribute('src', scifi);
    }
  } catch (e) {}
})();
