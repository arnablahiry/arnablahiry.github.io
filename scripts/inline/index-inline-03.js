        document.getElementById("year").textContent = new Date().getFullYear();

        // Handle start button hover and click for sidebar opacity
        const startButton = document.querySelector('.start-button');
        const sidebar = document.querySelector('.home-left-sidebar');
        const startPrompt = document.getElementById('start-prompt');
        
        const rightSidebar = document.getElementById('home-right-sidebar');

        function getDesktopCards() {
          var leftCards = sidebar ? Array.from(sidebar.querySelectorAll('.sidebar-link')) : [];
          var rightCards = rightSidebar ? Array.from(rightSidebar.querySelectorAll('.sidebar-link, #good-news-box')) : [];
          return { leftCards: leftCards, rightCards: rightCards };
        }

        function resetCardAnimations(cards) {
          cards.forEach(function (el) {
            el.classList.remove('pop-in', 'pop-out');
            el.style.animationDelay = '';
            el.style.animationDuration = '';
            el.style.animationName = '';
            el.style.transform = '';
            el.style.opacity = '';
            el.style.transformOrigin = '';
          });
        }

        function clearDesktopSidebarInlineStyles() {
          [sidebar, rightSidebar].forEach(function (el) {
            if (!el) return;
            el.style.transition = '';
            el.style.opacity = '';
            el.style.pointerEvents = '';
          });
        }

        function animateCardsIn(leftCards, rightCards) {
          leftCards = leftCards || [];
          rightCards = rightCards || [];
          // Reset both groups
          resetCardAnimations(leftCards.concat(rightCards));

          // Stagger both sides independently but start at the same time
          leftCards.forEach(function (el, index) {
            el.style.opacity = '0';
            el.style.transform = 'scale(0.88)';
            el.style.transformOrigin = 'center center';
            el.style.animationDelay = (index * 110) + 'ms';
            el.classList.add('pop-in');
          });

          rightCards.forEach(function (el, index) {
            el.style.opacity = '0';
            el.style.transform = 'scale(0.88)';
            el.style.transformOrigin = 'center center';
            el.style.animationDelay = (index * 110) + 'ms';
            el.classList.add('pop-in');
          });
        }

        function animateCardsOut(cards, onDone) {
          var reversed = cards.slice().reverse();
          reversed.forEach(function (el, index) {
            el.classList.remove('pop-in');
            el.style.animationDelay = (index * 90) + 'ms';
            el.style.transformOrigin = 'center center';
            el.classList.add('pop-out');
          });
          var totalMs = (reversed.length - 1) * 90 + 280;
          setTimeout(function () {
            resetCardAnimations(cards);
            if (typeof onDone === 'function') onDone();
          }, Math.max(totalMs, 0));
        }

        function closeDesktopSidebar() {
          var groups = getDesktopCards();
          var cards = (groups.leftCards || []).concat(groups.rightCards || []);
          // include the stop prompt so it pops out with the cards
          var stopPromptEl = document.getElementById('stop-prompt');
          if (stopPromptEl) cards.push(stopPromptEl);
          animateCardsOut(cards, function () {
            if (sidebar) {
              sidebar.style.transition = 'none';
              sidebar.style.opacity = '0';
              sidebar.style.pointerEvents = 'none';
            }
            if (rightSidebar) {
              rightSidebar.style.transition = 'none';
              rightSidebar.style.opacity = '0';
              rightSidebar.style.pointerEvents = 'none';
            }
            if (rightSidebar) rightSidebar.classList.remove('start-clicked');
            if (sidebar) sidebar.classList.remove('start-clicked');
            if (startPrompt) startPrompt.classList.remove('unlocked');
            startButton.classList.remove('unlocked');
              if (rightSidebar) rightSidebar.classList.remove('start-hovered');
            if (sidebar) sidebar.classList.remove('start-hovered');
            resetCardAnimations(cards);
          });
        }

        if (startButton && sidebar) {
          startButton.addEventListener('mouseenter', () => {
            sidebar.classList.add('start-hovered');
            if (rightSidebar) rightSidebar.classList.add('start-hovered');
          });

          startButton.addEventListener('mouseleave', () => {
            sidebar.classList.remove('start-hovered');
            if (rightSidebar) rightSidebar.classList.remove('start-hovered');
          });

          // Freeze an element at fromOpacity inline, then transition to 1
          function fadeInFrom(el, fromOpacity, durationMs) {
            if (!el) return;
            el.style.animation = 'none';
            el.style.transition = 'none';
            el.style.opacity = fromOpacity;
            el.offsetHeight; // force reflow — commits the frozen value
            el.style.transition = 'opacity ' + durationMs + 'ms ease';
            el.style.opacity = '1';
            setTimeout(function () {
              el.style.animation = '';
              el.style.transition = '';
              el.style.opacity = '';
            }, durationMs);
          }

          var mobileOverlay = document.getElementById('mobile-nav-overlay');
          var mobileGoodNewsSlot = document.getElementById('mobile-good-news-slot');
          var goodNewsBox = document.getElementById('good-news-box');
          var goodNewsOriginalParent = goodNewsBox ? goodNewsBox.parentNode : null;
          var goodNewsNextSibling = goodNewsBox ? goodNewsBox.nextSibling : null;

          function openMobileOverlay() {
            if (!mobileOverlay) return;
            // Move good-news box into the slot so its live content shows
            if (goodNewsBox && mobileGoodNewsSlot) {
              mobileGoodNewsSlot.appendChild(goodNewsBox);
            }
            // Hide footer while overlay is open
            var footer = document.querySelector('footer');
            if (footer) {
              footer.classList.add('mobile-hidden');
            }
            // Force animation replay by removing class, triggering reflow, re-adding
            // pop-in the mobile stop prompt
            var mobileStopPrompt = document.getElementById('mobile-stop-prompt');
            if (mobileStopPrompt) {
              mobileStopPrompt.classList.remove('pop-out', 'pop-in');
              mobileStopPrompt.style.animationDelay = '0ms';
              mobileStopPrompt.classList.add('pop-in');
            }

            mobileOverlay.classList.remove('active');
            mobileOverlay.offsetHeight; // reflow
            mobileOverlay.classList.add('active');
            mobileOverlay.setAttribute('aria-hidden', 'false');
          }

          function closeMobileOverlay() {
            if (!mobileOverlay) return;
            // Animate out: items pop out in reverse, then overlay fades
            // pop-out mobile stop prompt
            var mobileStopPrompt = document.getElementById('mobile-stop-prompt');
            if (mobileStopPrompt) {
              mobileStopPrompt.classList.remove('pop-in');
              mobileStopPrompt.classList.add('pop-out');
            }

            mobileOverlay.classList.remove('active');
            mobileOverlay.classList.add('closing');
            // After animations finish (~480ms), hide and restore DOM
            setTimeout(function () {
              mobileOverlay.classList.remove('closing');
              mobileOverlay.setAttribute('aria-hidden', 'true');
              // Return good-news box to its original position in the right sidebar
              if (goodNewsBox && goodNewsOriginalParent) {
                goodNewsOriginalParent.insertBefore(goodNewsBox, goodNewsNextSibling);
              }
              // clean up mobile stop prompt classes
              var mobileStopPromptCleanup = document.getElementById('mobile-stop-prompt');
              if (mobileStopPromptCleanup) {
                mobileStopPromptCleanup.classList.remove('pop-out', 'pop-in');
                mobileStopPromptCleanup.style.animationDelay = '';
              }
              // Restore footer visibility
              var footer = document.querySelector('footer');
              if (footer) {
                footer.classList.remove('mobile-hidden');
              }
              if (rightSidebar) rightSidebar.classList.remove('start-clicked');
              sidebar.classList.remove('start-clicked');
              startButton.classList.remove('unlocked');
              if (startPrompt) startPrompt.classList.remove('unlocked');
              if (rightSidebar) rightSidebar.classList.remove('start-hovered');
              sidebar.classList.remove('start-hovered');
            }, 480);
          }

          var mobileStopBtn = document.getElementById('mobile-stop-button');
          if (mobileStopBtn) {
            mobileStopBtn.addEventListener('click', closeMobileOverlay);
          }

          var desktopStopBtn = document.getElementById('stop-button');
          if (desktopStopBtn) {
            desktopStopBtn.addEventListener('click', closeDesktopSidebar);
          }

          startButton.addEventListener('click', () => {
            var isMobile = window.innerWidth <= 768;

            if (isMobile) {
              openMobileOverlay();
            } else {
              clearDesktopSidebarInlineStyles();
              sidebar.classList.remove('start-hovered');
              sidebar.classList.add('start-clicked');

              if (rightSidebar) {
                rightSidebar.classList.remove('start-hovered');
                rightSidebar.classList.add('start-clicked');
              }

              var groups = getDesktopCards();
              animateCardsIn(groups.leftCards, groups.rightCards);

              // Pop-in the stop prompt instead of fading it
              var stopPromptEl = document.getElementById('stop-prompt');
              if (stopPromptEl) {
                stopPromptEl.classList.remove('pop-out', 'pop-in');
                // small delay so cards start at same time; no delay keeps it synced
                stopPromptEl.style.animationDelay = '0ms';
                stopPromptEl.classList.add('pop-in');
              }

              // desktop stop is wired once above
            }

            // Add unlocked class to stop pulsing and dim the text
            startButton.classList.add('unlocked');
            if (startPrompt) {
              startPrompt.classList.add('unlocked');
            }
          });
        }
