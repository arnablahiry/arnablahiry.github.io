        (function(){
            // Project tag filtering
            var filterBar = document.getElementById('project-filters');
            if (!filterBar) return;
            var buttons = Array.prototype.slice.call(filterBar.querySelectorAll('.filter-btn'));
            var cards = Array.prototype.slice.call(document.querySelectorAll('.project-card'));

            function setFilter(filter){
                buttons.forEach(function(b){
                    var active = (b.dataset.filter === filter);
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-pressed', active ? 'true' : 'false');
                });

                if (filter === 'all'){
                    cards.forEach(function(c){ c.classList.remove('card-hidden'); });
                } else {
                    cards.forEach(function(c){
                        var tags = (c.dataset.tags || '').toLowerCase().split(',').map(function(s){return s.trim();});
                        if (tags.indexOf(filter) !== -1) c.classList.remove('card-hidden');
                        else c.classList.add('card-hidden');
                    });
                }
            }

            filterBar.addEventListener('click', function(e){
                var btn = e.target.closest('.filter-btn');
                if (!btn) return;
                setFilter(btn.dataset.filter);
            });

            // keyboard activation for buttons
            buttons.forEach(function(b){
                b.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
            });
        })();
