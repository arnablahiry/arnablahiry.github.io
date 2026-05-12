    // Photo hover/focus -> highlight marker + dim rest of page
    (function(){
      try{
        const imgs = Array.from(document.querySelectorAll('.about-collage img'));
        const markers = Array.from(document.querySelectorAll('.about-timeline .timeline-marker'));

        // Compute gradient-matched colors for each marker and set CSS vars.
        try{
          const start = { r: 238, g: 9, b: 121 }; // #ee0979
          const end = { r: 255, g: 215, b: 0 };   // gold (#ffd700)
          const lineLeft = 6.25;  // percent where line starts
          const lineRight = 93.75; // percent where line ends
          const span = lineRight - lineLeft;
          markers.forEach(marker => {
            const leftStr = (marker.style.left || '').trim();
            const leftPct = leftStr.endsWith('%') ? parseFloat(leftStr) : NaN;
            const pos = Number.isFinite(leftPct) ? leftPct : 0;
            let t = (pos - lineLeft) / span;
            if(t < 0) t = 0; if(t > 1) t = 1;
            const r = Math.round(start.r + (end.r - start.r) * t);
            const g = Math.round(start.g + (end.g - start.g) * t);
            const b = Math.round(start.b + (end.b - start.b) * t);
            const rgb = `rgb(${r}, ${g}, ${b})`;
            const glow = `rgba(${r}, ${g}, ${b}, 0.9)`;
            marker.style.setProperty('--marker-color', rgb);
            marker.style.setProperty('--marker-glow', glow);
          });
        }catch(err){ console.warn('marker color compute error', err); }

        // Position markers so they sit centered under their corresponding
        // image(s). This ensures pixel-perfect alignment even when the
        // collage has horizontal padding or the viewport resizes.
        (function positionMarkersSetup(){
          const timeline = document.querySelector('.about-timeline');
          if(!timeline) return;

          function markerMap(mIdx){
            if(mIdx <= 4) return [mIdx];
            if(mIdx === 5) return [5,6];
            return [7];
          }

          function computeAndPlace(){
            const tRect = timeline.getBoundingClientRect();
            const timelineLine = timeline.querySelector('.timeline-line');
            let minPct = 100, maxPct = 0;
            markers.forEach((marker, mIdx) => {
              const mapped = markerMap(mIdx);
              // average center x of mapped images
              const centers = mapped.map(i => {
                const el = imgs[i];
                if(!el) return null;
                const r = el.getBoundingClientRect();
                return r.left + r.width / 2;
              }).filter(Boolean);
              if(centers.length === 0) return;
              const avg = centers.reduce((a,b) => a + b, 0) / centers.length;
              const leftPx = avg - tRect.left;
              const pct = (leftPx / tRect.width) * 100;
              marker.style.left = pct + '%';
              // Set tooltip width/position. Support multiple tooltips inside a
              // single (combined) marker: we position each tooltip so it is
              // centered under its corresponding image even though the dot
              // (marker) itself remains a single element.
              const markerRect = marker.getBoundingClientRect();
              const tooltips = Array.from(marker.querySelectorAll('.timeline-tooltip'));
              if(tooltips.length){
                // compute widths per mapped image (use individual widths when
                // multiple, otherwise fall back to avg)
                const widths = mapped.map(i => {
                  const el = imgs[i]; if(!el) return null; return el.getBoundingClientRect().width;
                }).filter(Boolean);

                // If there's only one tooltip (most markers), center it on the
                // marker as before and size it to the avg mapped width.
                if(tooltips.length === 1){
                  if(widths.length){
                    const avgW = widths.reduce((a,b) => a + b, 0) / widths.length;
                    const w = Math.max(80, Math.round(avgW * 0.92));
                    tooltips[0].style.width = w + 'px';
                  }
                  // keep centered on the marker
                  tooltips[0].style.left = '50%';
                  tooltips[0].style.transform = 'translateX(-50%) scale(0.98)';
                } else {
                  // Multiple tooltips: align each tooltip under its mapped image
                  tooltips.forEach((tt, j) => {
                    const imgIdx = mapped[j];
                    const el = imgs[imgIdx];
                    if(!el) return;
                    const r = el.getBoundingClientRect();
                    const centerAbs = r.left + r.width / 2; // page coords
                    // left relative to the marker's left edge (page coords)
                    const leftRel = centerAbs - markerRect.left;
                    // apply width tuned to the specific image
                    const w = Math.max(72, Math.round(r.width * 0.92));
                    tt.style.width = w + 'px';
                    // position tooltip so its center sits at leftRel within the
                    // marker's coordinate space. Keep translateX(-50%) to center.
                    tt.style.left = leftRel + 'px';
                    tt.style.transform = 'translateX(-50%) scale(0.98)';
                  });
                }
              }
              if(pct < minPct) minPct = pct;
              if(pct > maxPct) maxPct = pct;
            });
            // If we found valid mins/maxes, set the timeline line to span them.
            if(timelineLine && minPct <= maxPct){
              // left is minPct% from left of timeline, right should be (100 - maxPct)%
              timelineLine.style.left = minPct + '%';
              timelineLine.style.right = (100 - maxPct) + '%';
            }
          }

          // debounce helper
          let resizeHandle = null;
          function delayedCompute(){
            if(resizeHandle) clearTimeout(resizeHandle);
            resizeHandle = setTimeout(() => { computeAndPlace(); resizeHandle = null; }, 80);
          }

          // run now and on next tick (images may still load)
          computeAndPlace();
          setTimeout(computeAndPlace, 250);

          window.addEventListener('resize', delayedCompute);
          window.addEventListener('orientationchange', delayedCompute);
        })();

        function imgToMarkerIndex(idx){
          if(idx <= 4) return idx;
          if(idx === 7) return 6;
          return 5; // idx 5 or 6 -> combined marker
        }

        imgs.forEach((img, idx) => {
          const mIdx = imgToMarkerIndex(idx);
          const marker = markers[mIdx];
          if(!marker) return;

            // find the specific tooltip element inside the marker that corresponds
            // to this image (markers may contain multiple tooltips for grouped
            // images). We will toggle visibility on this tooltip only when the
            // image is hovered.
            const _tooltips = Array.from(marker.querySelectorAll('.timeline-tooltip'));
            let tooltipEl = null;
            if(_tooltips.length === 1){ tooltipEl = _tooltips[0]; }
            else if(_tooltips.length > 1){
              // combined marker (mIdx === 5) maps tooltips[0] -> image idx 5,
              // tooltips[1] -> image idx 6
              if(mIdx === 5){ tooltipEl = _tooltips[idx === 5 ? 0 : 1]; }
              else { tooltipEl = _tooltips[0]; }
            }

          // Hovering a photo highlights only that photo. Photos 6 and 7
          // (indexes 5 and 6) will be highlighted together only when the
          // combined timeline marker is hovered (marker handlers below).
          const groupIndices = [idx];

          function addFocusToGroup(){
            document.body.classList.add('photo-focused');
            groupIndices.forEach(i => {
              const el = imgs[i];
              if(el) el.classList.add('focused');
            });
            // Show only the tooltip belonging to this image (if any).
            if(tooltipEl) tooltipEl.classList.add('is-visible');
            // Also highlight the corresponding timeline dot so hovering the
            // image has the same marker effect as hovering the dot itself.
            // We use a separate class (`dot-highlight`) so we can style the
            // dot without revealing multiple tooltips for combined markers.
            try{ if(marker && marker.classList) marker.classList.add('dot-highlight'); }catch(e){}
          }

          function removeFocusFromGroup(){
            // Remove focus only when none of the group images are hovered or focused
            const anyHoveredOrFocused = groupIndices.some(i => {
              const el = imgs[i];
              if(!el) return false;
              return el.matches(':hover') || document.activeElement === el;
            });
            if(anyHoveredOrFocused) return;

            document.body.classList.remove('photo-focused');
            groupIndices.forEach(i => {
              const el = imgs[i];
              if(el) el.classList.remove('focused');
            });
            if(tooltipEl) tooltipEl.classList.remove('is-visible');
            // Remove the transient dot highlight unless the marker is truly
            // active (e.g. because the user is hovering the marker itself).
            try{ if(marker && marker.classList && !marker.classList.contains('active')) marker.classList.remove('dot-highlight'); }catch(e){}
          }

          img.addEventListener('mouseenter', addFocusToGroup);
          img.addEventListener('mouseleave', removeFocusFromGroup);
          img.addEventListener('focus', addFocusToGroup);
          img.addEventListener('blur', removeFocusFromGroup);

          // marker hover handling is attached once per marker below to keep
          // a single source of truth for marker -> image mapping.
        });
        
        // Attach hover/focus handlers to markers so hovering a marker also
        // highlights the corresponding image(s). This is added once per
        // marker to avoid duplicate listeners when multiple images map to
        // the same combined marker.
        markers.forEach((marker, mIdx) => {
          // map marker index back to image indices: 0-4 -> [i], 5 -> [5,6], 6 -> [7]
          const mapped = (function(){
            if(mIdx <= 4) return [mIdx];
            if(mIdx === 5) return [5,6];
            return [7];
          })();

          function addFocusToMapped(){
            document.body.classList.add('photo-focused');
            mapped.forEach(i => { const el = imgs[i]; if(el) el.classList.add('focused'); });
            marker.classList.add('active');
          }

          function removeFocusFromMapped(){
            const anyHoveredOrFocused = mapped.some(i => {
              const el = imgs[i]; if(!el) return false;
              return el.matches(':hover') || document.activeElement === el;
            });
            if(anyHoveredOrFocused) return;
            document.body.classList.remove('photo-focused');
            mapped.forEach(i => { const el = imgs[i]; if(el) el.classList.remove('focused'); });
            marker.classList.remove('active');
          }

          marker.addEventListener('mouseenter', addFocusToMapped);
          marker.addEventListener('mouseleave', removeFocusFromMapped);
          // Also allow keyboard focus: if marker receives focus (rare), treat it similarly.
          marker.addEventListener('focus', addFocusToMapped);
          marker.addEventListener('blur', removeFocusFromMapped);
        });
      }catch(e){ console.warn('timeline hover wiring error', e); }
    })();
