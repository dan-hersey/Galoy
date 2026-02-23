// Mobile navigation toggle
(function() {
  var toggle = document.querySelector('.navbar-toggle');
  var nav = document.querySelector('.navbar-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function() {
    toggle.classList.toggle('active');
    nav.classList.toggle('mobile-open');
  });

  // Handle dropdown toggles on mobile
  var dropdownLinks = nav.querySelectorAll('.nav-link-dropdown');
  dropdownLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      // Only intercept on mobile (when hamburger is visible)
      if (window.getComputedStyle(toggle).display === 'none') return;
      e.preventDefault();
      var parentLi = this.closest('li');
      var wasOpen = parentLi.classList.contains('mobile-dropdown-open');

      // Close all dropdowns
      nav.querySelectorAll('li.mobile-dropdown-open').forEach(function(li) {
        li.classList.remove('mobile-dropdown-open');
      });

      // Toggle the clicked one
      if (!wasOpen) {
        parentLi.classList.add('mobile-dropdown-open');
      }
    });
  });

  // Close mobile nav when clicking outside
  document.addEventListener('click', function(e) {
    if (!nav.contains(e.target) && !toggle.contains(e.target)) {
      toggle.classList.remove('active');
      nav.classList.remove('mobile-open');
    }
  });
})();
