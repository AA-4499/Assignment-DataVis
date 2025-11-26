// Wait for the included navigation to appear, then mark the matching link as active.
(function setActiveNav(){
    const nav = document.querySelector('.navbar');
    if (!nav) {
        // try again shortly (w3.includeHTML is asynchronous)
        return setTimeout(setActiveNav, 60);
    }

    const getFile = s => {
        if (!s) return '';
        s = s.split('#')[0].split('?')[0];
        const parts = s.split('/');
        return decodeURIComponent(parts[parts.length-1] || '');
    };

    const current = getFile(location.pathname.split('/').pop() || 'index.html');
    // also check title or fallback to index.html
    nav.querySelectorAll('a.nav-btn').forEach(a => {
        const href = a.getAttribute('href') || '';
        const linkFile = getFile(href);
        if (linkFile === current || (current === '' && linkFile === 'index.html')) {
            a.classList.add('active');
            // set aria-current for accessibility
            a.setAttribute('aria-current', 'page');
        } else {
            a.classList.remove('active');
            a.removeAttribute('aria-current');
        }
    });
})();