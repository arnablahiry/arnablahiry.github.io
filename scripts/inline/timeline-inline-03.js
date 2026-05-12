      (function formatTimelineDates(){
        const els = document.querySelectorAll('.timeline-date-text');
        els.forEach((el) => {
          const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const m = raw.match(/^(.*?)(\b\d{4}\b)\s*$/);
          if (!m) return;
          let prefix = m[1].replace(/\s+,/g, ',').trim();
          if (/^January,\s*February$/i.test(prefix)) {
            prefix = 'January,<br>February';
          }
          const year = m[2].trim();
          el.innerHTML = (prefix ? (prefix + '<br>') : '') + '<span class="timeline-year-part">' + year + '</span>';
        });
      })();

      (function assignTimelineAlternation(){
        const items = document.querySelectorAll('.timeline-component > .timeline-item');
        items.forEach((item, index) => {
          item.classList.toggle('timeline-item-even', index % 2 === 0);
          item.classList.toggle('timeline-item-odd', index % 2 === 1);
        });
      })();

      (function initTimelineBreakout(){
        const bridges = Array.prototype.slice.call(document.querySelectorAll('[data-timeline-breakout]'));
        if (!bridges.length) return;
        if (window.innerWidth <= 768) return;

        let rafId = 0;

        function updateBreakouts() {
          rafId = 0;
          const viewportCenter = window.innerHeight * 0.5;

          bridges.forEach((bridge) => {
            const rect = bridge.getBoundingClientRect();
            const lineCenter = rect.top + (rect.height * 0.5);
            const visible = rect.bottom > 0 && rect.top < window.innerHeight;
            const distance = Math.abs(lineCenter - viewportCenter);
            const proximity = Math.max(0, 1 - (distance / Math.max(window.innerHeight * 0.22, 1)));
            const alpha = 0.2 + (0.4 * proximity);
            const shadowAlpha = 0.1 + (0.62 * proximity);
            const shadowSize = 3 + (18 * proximity);

            bridge.classList.toggle('is-visible', visible);
            bridge.style.setProperty('--timeline-breakout-alpha', alpha.toFixed(4));
            bridge.style.setProperty('--timeline-breakout-shadow-alpha', shadowAlpha.toFixed(4));
            bridge.style.setProperty('--timeline-breakout-shadow-size', shadowSize.toFixed(2) + 'px');
          });
        }

        function requestUpdate() {
          if (rafId) return;
          rafId = window.requestAnimationFrame(updateBreakouts);
        }

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        updateBreakouts();
      })();
