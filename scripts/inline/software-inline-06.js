            // Ensure project badges match the width/height of the first tag chip
            (function(){
                function syncBadges(){
                    var cards = document.querySelectorAll('.project-card');
                    cards.forEach(function(card){
                        var tag = card.querySelector('.project-tags .tag-chip');
                        var badges = card.querySelector('.project-badges');
                        if(!tag || !badges) return;
                        var tagRect = tag.getBoundingClientRect();
                        var tagWidth = Math.round(tagRect.width);
                        var tagHeight = Math.round(tagRect.height);
                        // Make each individual badge match the tag width/height so
                        // badges are the same size as the tag (not the whole block).
                        var imgs = badges.querySelectorAll('img');
                        imgs.forEach(function(img){
                            img.style.height = tagHeight - 6 + 'px';
                            img.style.objectFit = 'contain';
                            img.style.display = 'inline-block';
                        });
                        // keep a consistent small gap between tag and badges
                        badges.style.marginLeft = '6px';
                    });
                }
                document.addEventListener('DOMContentLoaded', syncBadges);
                window.addEventListener('load', syncBadges);
                window.addEventListener('resize', function(){ setTimeout(syncBadges, 80); });
            })();
