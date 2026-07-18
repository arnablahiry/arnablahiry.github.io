(function initGoodNews() {
  var box = document.getElementById('good-news-box');
  if (!box) return;

  // Clear any stale cached data from previous versions
  try {
    Object.keys(localStorage).forEach(function(k) {
      if (k.indexOf('goodnews') === 0) localStorage.removeItem(k);
    });
  } catch(e) {}

  var headlineEl = document.getElementById('good-news-headline');
  var linkEl = document.getElementById('good-news-link');
  var nextBtn = document.getElementById('good-news-next');

  var articles = [];
  var currentIndex = 0;
  var cycleTimer = null;


  function showArticle(index, animate) {
    if (!articles.length || !headlineEl || !linkEl) return;
    currentIndex = ((index % articles.length) + articles.length) % articles.length;
    var a = articles[currentIndex];
    if (animate) {
      headlineEl.style.opacity = '0';
      linkEl.style.opacity = '0';
      setTimeout(function () {
        if (!headlineEl || !linkEl) return;
        headlineEl.textContent = a.title;
        linkEl.href = a.link;
        headlineEl.style.opacity = '1';
        linkEl.style.opacity = '1';
      }, 300);
    } else {
      headlineEl.textContent = a.title;
      linkEl.href = a.link;
    }
  }

  function startCycle() {
    if (cycleTimer) clearInterval(cycleTimer);
    if (articles.length < 2) return;
    cycleTimer = setInterval(function () {
      showArticle(currentIndex + 1, true);
    }, 8000);
  }

  function handleNextClick() {
    showArticle(currentIndex + 1, true);
    startCycle();
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', handleNextClick);
  }

  function renderNews(data) {
    articles = data.slice(0, 5);
    if (!articles.length) return;
    showArticle(0, false);
    startCycle();
  }

  // Restart cycle when tab regains focus — browsers throttle setInterval in background tabs
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && articles.length) {
      startCycle();
    }
  });

  function loadNews() {
    var items = (window.NEWS_ITEMS || []).map(function(item) {
      return { title: item.title, link: item.link || '#' };
    });
    renderNews(items);
  }

  function revealBox() {
    loadNews();
    requestAnimationFrame(function () {
      box.classList.add('gn-ready');
    });
  }

  var startButton = document.querySelector('.start-button');
  if (startButton) {
    if (startButton.classList.contains('unlocked')) {
      revealBox();
    } else {
      var observer = new MutationObserver(function () {
        if (startButton.classList.contains('unlocked')) {
          observer.disconnect();
          revealBox();
        }
      });
      observer.observe(startButton, { attributes: true, attributeFilter: ['class'] });
    }
  }
})();
