        document.getElementById("year").textContent = new Date().getFullYear();

        // Center #audio-controls horizontally under the 3 nav icon buttons
        // (theme-toggle → scifi-toggle → nav-music-toggle).
        function positionAudioControls() {
          var themeBtn  = document.getElementById('theme-toggle');
          var musicBtn  = document.getElementById('nav-music-toggle');
          var controls  = document.getElementById('audio-controls');
          if (!themeBtn || !musicBtn || !controls) return;
          var groupLeft  = themeBtn.getBoundingClientRect().left;
          var groupRight = musicBtn.getBoundingClientRect().right;
          var center     = (groupLeft + groupRight) / 2;
          controls.style.left      = Math.round(center - controls.offsetWidth / 2) + 'px';
          controls.style.right     = 'auto';
          controls.style.transform = 'none';
        }
        requestAnimationFrame(positionAudioControls);
        window.addEventListener('resize', positionAudioControls);

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

          startButton.addEventListener('click', () => {
            // Capture current opacities BEFORE class changes so CSS rules haven't overridden them yet
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
              stopBtn.addEventListener('click', () => {
                rightSidebar.classList.remove('start-clicked');
                sidebar.classList.remove('start-clicked');
                startButton.classList.remove('unlocked');
                if (startPrompt) startPrompt.classList.remove('unlocked');
              });
            }
            
            // Add unlocked class to stop pulsing and dim the text
            startButton.classList.add('unlocked');
            if (startPrompt) {
              startPrompt.classList.add('unlocked');
            }
          });
        }
