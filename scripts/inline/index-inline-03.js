        document.getElementById("year").textContent = new Date().getFullYear();

        // Handle start button hover and click for sidebar opacity
        const startButton = document.querySelector('.start-button');
        const sidebar = document.querySelector('.home-left-sidebar');
        const startPrompt = document.getElementById('start-prompt');
        
        const rightSidebar = document.getElementById('home-right-sidebar');

        if (startButton && sidebar) {
          startButton.addEventListener('mouseenter', () => {
            sidebar.classList.add('start-hovered');
            if (rightSidebar && !rightSidebar.classList.contains('start-clicked')) {
              rightSidebar.classList.add('start-hovered');
            }
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
            // Force animation replay by removing class, triggering reflow, re-adding
            mobileOverlay.classList.remove('active');
            mobileOverlay.offsetHeight; // reflow
            mobileOverlay.classList.add('active');
            mobileOverlay.setAttribute('aria-hidden', 'false');
          }

          function closeMobileOverlay() {
            if (!mobileOverlay) return;
            // Animate out: items pop out in reverse, then overlay fades
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
              if (rightSidebar) rightSidebar.classList.remove('start-clicked');
              sidebar.classList.remove('start-clicked');
              startButton.classList.remove('unlocked');
              if (startPrompt) startPrompt.classList.remove('unlocked');
            }, 480);
          }

          var mobileStopBtn = document.getElementById('mobile-stop-button');
          if (mobileStopBtn) {
            mobileStopBtn.addEventListener('click', closeMobileOverlay);
          }

          startButton.addEventListener('click', () => {
            var isMobile = window.innerWidth <= 768;

            if (isMobile) {
              openMobileOverlay();
            } else {
              // Desktop: fade in the sidebars as before
              var sidebarFrom = parseFloat(getComputedStyle(sidebar).opacity);
              var links = rightSidebar ? Array.from(rightSidebar.querySelectorAll('.sidebar-link')) : [];
              var linksFrom = links.map(function (el) { return parseFloat(getComputedStyle(el).opacity); });

              sidebar.classList.remove('start-hovered');
              sidebar.classList.add('start-clicked');
              fadeInFrom(sidebar, sidebarFrom, 600);

              if (rightSidebar) {
                rightSidebar.classList.remove('start-hovered');
                rightSidebar.classList.add('start-clicked');
                links.forEach(function (el, i) { fadeInFrom(el, linksFrom[i], 600); });
                fadeInFrom(document.getElementById('stop-prompt'), 0, 600);
              }

              const stopBtn = document.getElementById('stop-button');
              if (stopBtn) {
                stopBtn.addEventListener('click', closeMobileOverlay);
              }
            }

            // Add unlocked class to stop pulsing and dim the text
            startButton.classList.add('unlocked');
            if (startPrompt) {
              startPrompt.classList.add('unlocked');
            }
          });
        }
