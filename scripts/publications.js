document.addEventListener('DOMContentLoaded', () => {
    const projectToggles = document.querySelectorAll('.project-toggle');

    projectToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const card = toggle.closest('.project-card');
            if (!card) return;
            const projectFull = card.querySelector('.project-full');
            if (!projectFull) return;

            const expanded = projectFull.getAttribute('aria-expanded') === 'true';

            if (expanded) {
                // Collapse: if maxHeight is 'none', set it to scrollHeight first
                if (projectFull.style.maxHeight === 'none') {
                    projectFull.style.maxHeight = projectFull.scrollHeight + 'px';
                }
                projectFull.style.opacity = '0';
                // Force reflow then set to 0 for transition
                requestAnimationFrame(() => {
                    projectFull.style.maxHeight = '0px';
                });
                toggle.setAttribute('aria-expanded', 'false');
                toggle.textContent = 'Show Abstract';

                const onCollapseEnd = (e) => {
                    if (e.propertyName === 'max-height' && projectFull.getAttribute('aria-expanded') === 'false') {
                        projectFull.removeEventListener('transitionend', onCollapseEnd);
                    }
                };

                projectFull.addEventListener('transitionend', onCollapseEnd);
                projectFull.setAttribute('aria-expanded', 'false');
            } else {
                // Expand: set aria and animate to scrollHeight
                projectFull.setAttribute('aria-expanded', 'true');
                toggle.setAttribute('aria-expanded', 'true');
                // ensure element can transition from 0 to measured height
                const target = projectFull.scrollHeight;
                requestAnimationFrame(() => {
                    projectFull.style.opacity = '1';
                });
                projectFull.style.maxHeight = target + 'px';
                toggle.textContent = 'Hide Abstract';

                // After transition, clear inline maxHeight so content can grow naturally
                const onTransitionEnd = (e) => {
                    if (e.propertyName === 'max-height') {
                        // Only clear when expanded
                        if (projectFull.getAttribute('aria-expanded') === 'true') {
                            projectFull.style.maxHeight = 'none';
                        }
                        projectFull.removeEventListener('transitionend', onTransitionEnd);
                    }
                };
                projectFull.addEventListener('transitionend', onTransitionEnd);
            }
        });
    });
});