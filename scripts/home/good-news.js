(function initGoodNews() {
  var box = document.getElementById('good-news-box');
  if (!box) return;

  if (window.innerWidth <= 1150) return;

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
    articles = data.slice(0, 15);
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

  // Good News Network animals category — official RSS feed, legal to consume
  var RSS_URL = 'https://www.goodnewsnetwork.org/category/news/animals/feed/';
  var SOURCE_URL = 'https://www.goodnewsnetwork.org/category/news/animals/';

  var FALLBACK = [
    '18 Rescue Workers Toil for 6 Hours to Save Dog Trapped Underground',
    'EU Passes Animal Protection Law for Keeping, Breeding, and Selling',
    'Butterfly That Went Extinct in Britain a Century Ago Set for Return to Rewilded Estate',
    'Asiatic Wild Ass Returns to Eastern Mongolia After 65-year Isolation',
    'Mexican Monarch Butterfly Population Surges 64% in a Single Year',
    'Giant Tortoises Return to Galápagos Island After 175 Years',
    'Japan\'s Red-Crowned Crane Removed From Threatened List After Population Recovery',
    'White Rhinos Return to Uganda\'s Kidepo Valley After 43 Years',
    'New Zealand\'s Kākāpō Hatches a Record 100+ Chicks in Best Ever Breeding Season',
    'Rare North Atlantic Right Whale Population Growing Again After Years of Decline',
    'Green Turtles Bounce Back From Near-Extinction to Least Concern Status',
    'Scottish Wildcats Thriving in the Highlands as Kittens Born in the Wild',
    'Record Seahorse Numbers Signal Conservation Success in Dorset',
    'India\'s Cheetah Reintroduction Programme Boosted by Three New Cubs',
    'China\'s Yangtze River Shows Dramatic Recovery After Four-Year Fishing Ban'
  ].map(function(t) { return { title: t, link: SOURCE_URL }; });

  function fetchNews() {
    var apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(RSS_URL) + '&count=15';
    fetch(apiUrl)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.items || !data.items.length) throw new Error('no items');
        var items = data.items.map(function(item) {
          return { title: item.title, link: item.link || SOURCE_URL };
        });
        renderNews(items);
      })
      .catch(function() {
        renderNews(FALLBACK);
      });
  }

  function revealBox() {
    fetchNews();
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
