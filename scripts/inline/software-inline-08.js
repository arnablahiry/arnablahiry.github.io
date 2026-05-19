        (function(){
            // Project tag filtering with two independent filter groups
            var categoryFilterBar = document.getElementById('project-filters-category');
            var typeFilterBar = document.getElementById('project-filters-type');
            if (!categoryFilterBar || !typeFilterBar) return;
            
            var categoryButtons = Array.prototype.slice.call(categoryFilterBar.querySelectorAll('.filter-btn'));
            var typeButtons = Array.prototype.slice.call(typeFilterBar.querySelectorAll('.filter-btn'));
            var cards = Array.prototype.slice.call(document.querySelectorAll('.project-card'));

            var currentCategory = 'all-category';
            var currentType = 'all-type';

            function applyFilters(){
                cards.forEach(function(c){
                    var tags = (c.dataset.tags || '').toLowerCase().split(',').map(function(s){return s.trim();});
                    
                    // Check category filter
                    var categoryMatch = currentCategory === 'all-category' || tags.indexOf(currentCategory) !== -1;
                    
                    // Check type filter
                    var typeMatch = currentType === 'all-type' || tags.indexOf(currentType) !== -1;
                    
                    // Card is hidden only if it doesn't match both filters
                    if (categoryMatch && typeMatch) c.classList.remove('card-hidden');
                    else c.classList.add('card-hidden');
                });
            }

            // Category filter click handler
            categoryFilterBar.addEventListener('click', function(e){
                var btn = e.target.closest('.filter-btn');
                if (!btn) return;
                currentCategory = btn.dataset.filter;
                
                categoryButtons.forEach(function(b){
                    var active = (b.dataset.filter === currentCategory);
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                
                applyFilters();
            });

            // Type filter click handler
            typeFilterBar.addEventListener('click', function(e){
                var btn = e.target.closest('.filter-btn');
                if (!btn) return;
                currentType = btn.dataset.filter;
                
                typeButtons.forEach(function(b){
                    var active = (b.dataset.filter === currentType);
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                
                applyFilters();
            });

            // keyboard activation for all buttons
            var allButtons = categoryButtons.concat(typeButtons);
            allButtons.forEach(function(b){
                b.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
            });
        })();
