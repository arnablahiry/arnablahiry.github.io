// Repositories page script — fetch GitHub profile and repos and render cards.
  (function(){
  var username = 'arnablahiry';
  var apiBase = 'https://api.github.com';
  // To display only selected repositories, list their names here (exact repo.name).
  // Example: var selectedRepos = ['awesome-tool', 'paper-code', 'data-utils'];
  // If empty or omitted, all fetched repos will be shown.
  var selectedRepos = ['Denoiser3D-IFU', 'CNN2D-Cosmology-Interpretability', 'astrolore', 'CNN2D-GDF', 'GNN-3DCOM', 'ANN-power-spec'];

    function el(tag, attrs, children){
      var e = document.createElement(tag);
      if(attrs) Object.keys(attrs).forEach(function(k){ if(k==='class') e.className = attrs[k]; else if(k==='html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); });
      if(children) children.forEach(function(c){ e.appendChild(c); });
      return e;
    }

    function formatDate(iso){
      try{ var d = new Date(iso); return d.toLocaleDateString(); }catch(e){ return iso; }
    }

    function renderProfile(user){
      var grid = document.getElementById('repos-grid');
      // profile card — highlighted and first
      var profile = el('article',{class:'repo-card profile-card', tabindex:0});
      var avatar = el('img',{class:'profile-avatar', src:user.avatar_url, alt: user.login + ' avatar'});
  var meta = el('div',{class:'repo-meta'});
  meta.appendChild(el('h3', {class:'repo-title', html: user.name || user.login}));
  meta.appendChild(el('p', {class:'repo-subtitle', html: user.bio || (user.login + ' — GitHub') }));
  var links = el('div',{class:'repo-actions'});
  links.appendChild(el('a',{href:user.html_url, target:'_blank', class:'btn', html:'View profile'}));
  // place avatar first, then meta (which contains subtitle and the action)
  profile.appendChild(avatar);
  meta.appendChild(links);
  profile.appendChild(meta);
      // place at start
      grid.innerHTML = '';
      grid.appendChild(profile);
    }

    function renderRepo(repo){
      var grid = document.getElementById('repos-grid');
      var card = el('article',{class:'repo-card', tabindex:0});
      var head = el('div',{class:'repo-head'});
      head.appendChild(el('h4',{class:'repo-name', html: '<a href="'+repo.html_url+'" target="_blank">'+repo.name+'</a>'}));
      if(repo.language) head.appendChild(el('span',{class:'repo-lang', html:repo.language}));
      card.appendChild(head);
      if(repo.description) card.appendChild(el('p',{class:'repo-desc', html: repo.description}));

      var meta = el('div',{class:'repo-meta-row'});
      meta.appendChild(el('span',{class:'repo-stat', html: '★ '+repo.stargazers_count}));
      meta.appendChild(el('span',{class:'repo-stat', html: 'Forks: '+repo.forks_count}));
      meta.appendChild(el('span',{class:'repo-updated', html: 'Updated: '+formatDate(repo.updated_at)}));
      card.appendChild(meta);
      grid.appendChild(card);
    }

    function showError(msg){
      var grid = document.getElementById('repos-grid');
      grid.innerHTML = '<div class="repo-error">'+msg+'</div>';
    }

    // Fetch profile then repos
    fetch(apiBase + '/users/' + username).then(function(r){
      if(!r.ok) throw new Error('Profile fetch failed: '+r.status);
      return r.json();
    }).then(function(user){
      renderProfile(user);
      // fetch repos: public, sorted by updated
      return fetch(apiBase + '/users/' + username + '/repos?per_page=100&sort=updated');
    }).then(function(r){
      if(!r.ok) throw new Error('Repos fetch failed: '+r.status);
      return r.json();
    }).then(function(repos){
      if(!repos || repos.length===0){ showError('No public repositories found.'); return; }
      // If selectedRepos is specified, filter and preserve the order of selectedRepos
      var out = repos;
      if(Array.isArray(selectedRepos) && selectedRepos.length){
        var byName = Object.create(null);
        repos.forEach(function(r){ byName[r.name] = r; });
        out = [];
        selectedRepos.forEach(function(n){ if(byName[n]) out.push(byName[n]); });
        if(out.length===0){ showError('None of the selected repositories were found.'); return; }
      }
      // render repos (skip forks if you prefer)
      out.forEach(function(repo){ renderRepo(repo); });
    }).catch(function(err){
      console.error(err);
      showError('Could not load repositories. GitHub API rate limit or network error.');
    });

    // Small accessibility: allow Enter on repo cards to open repo link
    document.addEventListener('click', function(e){
      var a = e.target.closest('a'); if(a) return; // link clicked
      var card = e.target.closest('.repo-card');
      if(card && !card.classList.contains('profile-card')){
        var link = card.querySelector('.repo-name a'); if(link) window.open(link.href, '_blank');
      }
    });

    document.addEventListener('keydown', function(e){
      if(e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('repo-card')){
        var link = document.activeElement.querySelector('.repo-name a'); if(link) window.open(link.href, '_blank');
      }
    });
  })();