// Show / hide a publication's abstract with a smooth slide and fade both ways.
// The collapsed look (no padding, zero font size) comes from
// .project-full[aria-expanded="false"] in publications_style.css, so on hide
// the abstract keeps aria-expanded="true" until it has slid shut; switching
// earlier would snap it closed.
document.addEventListener('DOMContentLoaded', () => {
    const DURATION = 420;

    function bind(toggle) {
        if (toggle._abstractBound) return;
        toggle._abstractBound = true;
        toggle.addEventListener('click', () => {
            const card = toggle.closest('.project-card');
            const full = card && card.querySelector('.project-full');
            if (!full) return;
            const token = (full._abstractToken || 0) + 1;
            full._abstractToken = token;   // a newer click cancels an older one
            const done = (fn) => {
                const finish = () => { if (full._abstractToken === token) fn(); };
                const onEnd = (e) => {
                    if (e.target !== full || e.propertyName !== 'max-height') return;
                    full.removeEventListener('transitionend', onEnd);
                    finish();
                };
                full.addEventListener('transitionend', onEnd);
                setTimeout(() => { full.removeEventListener('transitionend', onEnd); finish(); }, DURATION + 120);
            };

            if (full.getAttribute('aria-expanded') === 'true' && toggle.getAttribute('aria-expanded') === 'true') {
                // hide: from the current height down to 0, then switch state
                full.style.maxHeight = full.scrollHeight + 'px';
                void full.offsetHeight;
                full.style.maxHeight = '0px';
                full.style.paddingTop = '0px';      // padding would hold it open
                full.style.paddingBottom = '0px';
                full.style.opacity = '0';
                toggle.setAttribute('aria-expanded', 'false');
                toggle.textContent = 'Show Abstract';
                done(() => {
                    full.setAttribute('aria-expanded', 'false');
                    full.style.maxHeight = '';
                    full.style.paddingTop = '';
                    full.style.paddingBottom = '';
                    full.style.opacity = '';
                });
            } else {
                // show: switch state first (restores padding and text), measure
                // the full height, then grow from 0 to it
                full.setAttribute('aria-expanded', 'true');
                toggle.setAttribute('aria-expanded', 'true');
                toggle.textContent = 'Hide Abstract';
                full.style.transition = 'none';
                full.style.maxHeight = 'none';
                full.style.paddingTop = '';
                full.style.paddingBottom = '';
                const target = full.scrollHeight;
                full.style.maxHeight = '0px';
                full.style.paddingTop = '0px';
                full.style.paddingBottom = '0px';
                full.style.opacity = '0';
                void full.offsetHeight;
                full.style.transition = '';
                full.style.paddingTop = '';
                full.style.paddingBottom = '';
                full.style.maxHeight = target + 'px';
                full.style.opacity = '1';
                done(() => { full.style.maxHeight = 'none'; });
            }
        });
    }

    document.querySelectorAll('.project-toggle').forEach(bind);
    window.PublicationsPage = { bindToggles: () => document.querySelectorAll('.project-toggle').forEach(bind) };
});
