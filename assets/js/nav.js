/* Shared mobile navigation toggle.
   Progressive enhancement: without JS the nav falls back to the
   stacked layout defined in base.css. */
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;

  var toggle = nav.querySelector('.nav-toggle');
  var menu = nav.querySelector('.nav-right');
  if (!toggle || !menu) return;

  nav.setAttribute('data-nav-enhanced', '');

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  setOpen(false);

  toggle.addEventListener('click', function () {
    setOpen(!nav.classList.contains('is-open'));
  });

  // Close when a link inside the menu is activated
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Reset state when returning to desktop layout
  var desktop = window.matchMedia('(min-width: 769px)');
  desktop.addEventListener('change', function (e) {
    if (e.matches) setOpen(false);
  });
})();
