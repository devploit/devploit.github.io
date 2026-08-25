(function () {
  var structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Daniel Púa',
    alternateName: 'devploit',
    url: 'https://devploit.dev',
    image: 'https://devploit.dev/assets/img/favicons/avatar.png',
    jobTitle: ['Head of Security', 'Security Researcher'],
    worksFor: {
      '@type': 'Organization',
      name: 'Magnific'
    },
    sameAs: [
      'https://github.com/devploit',
      'https://twitter.com/devploit',
      'https://www.linkedin.com/in/daniel-pua/',
      'https://blog.devploit.dev'
    ],
    knowsAbout: [
      'Offensive Security',
      'Penetration Testing',
      'CTF',
      'Application Security',
      'Bug Bounty',
      'Live Hacking Events'
    ]
  };
  var structuredDataElement = document.createElement('script');
  structuredDataElement.type = 'application/ld+json';
  structuredDataElement.textContent = JSON.stringify(structuredData);
  document.head.appendChild(structuredDataElement);

  var postsStatusEl = document.getElementById('posts-status');
  var postsState = 'loading';

  /* Active navigation */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('#work, #tools, #contact'));
  var visibleSections = {};

  function setActiveNav(id) {
    navLinks.forEach(function (link) {
      var isActive = link.getAttribute('data-nav') === id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function pickActiveSection() {
    var visibleIds = Object.keys(visibleSections);
    if (!visibleIds.length) {
      if (window.scrollY < window.innerHeight * 0.4) setActiveNav('work');
      return;
    }

    var activeId = visibleIds.reduce(function (bestId, currentId) {
      var bestSection = document.getElementById(bestId);
      var currentSection = document.getElementById(currentId);
      if (!bestSection || !currentSection) return bestId;

      var bestDistance = Math.abs(bestSection.getBoundingClientRect().top - 120);
      var currentDistance = Math.abs(currentSection.getBoundingClientRect().top - 120);
      return currentDistance < bestDistance ? currentId : bestId;
    });

    setActiveNav(activeId);
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      var targetId = link.getAttribute('data-nav');
      if (targetId) setActiveNav(targetId);
    });
  });

  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visibleSections[entry.target.id] = true;
        } else {
          delete visibleSections[entry.target.id];
        }
      });
      pickActiveSection();
    }, { rootMargin: '-20% 0px -55% 0px' });

    sections.forEach(function (section) { navObserver.observe(section); });
  }

  var initialNavId = window.location.hash ? window.location.hash.slice(1) : 'work';
  if (initialNavId !== 'work' && initialNavId !== 'tools' && initialNavId !== 'contact') {
    initialNavId = 'work';
  }
  setActiveNav(initialNavId);

  /* Scroll reveal with a progressive fallback */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(function (element) { revealObserver.observe(element); });
  } else {
    reveals.forEach(function (element) { element.classList.add('visible'); });
  }

  /* Blog feed */
  var container = document.getElementById('posts-container');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var blogOrigin = 'https://blog.devploit.dev';
  var fallbackPosts = [
    { tag: 'CTF · Exploitation', title: 'DEFCON Quals 2025 — Memory Bank writeup', date: 'Apr 2025', link: blogOrigin },
    { tag: 'AI Security', title: 'Cracking Gandalf: the Lakera AI challenge', date: 'Jul 2024', link: blogOrigin },
    { tag: 'AI Security', title: 'Hacking the Mind of AI: Pentesting LLMs', date: 'Jun 2024', link: blogOrigin }
  ];

  function formatDate(dateString) {
    var date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return months[date.getMonth()] + ' ' + date.getFullYear();
  }

  function safeBlogUrl(value) {
    try {
      var url = new URL(value, blogOrigin);
      if (url.protocol === 'https:' && url.origin === blogOrigin) return url.href;
    } catch (error) {
      return blogOrigin;
    }
    return blogOrigin;
  }

  function createPostField(className, value) {
    var field = document.createElement('div');
    field.className = className;
    field.textContent = value;
    return field;
  }

  function renderPosts(posts) {
    container.replaceChildren();
    posts.forEach(function (post) {
      var link = document.createElement('a');
      link.href = safeBlogUrl(post.link);
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'post-item';
      link.appendChild(createPostField('post-tag', post.tag));
      link.appendChild(createPostField('post-title', post.title));
      link.appendChild(createPostField('post-date', post.date));
      container.appendChild(link);
    });
  }

  function setPostsState(state) {
    postsState = state;
    if (!postsStatusEl) return;
    postsStatusEl.classList.toggle('is-live', state === 'live');
    postsStatusEl.textContent = state === 'live'
      ? 'live from blog'
      : state === 'fallback'
        ? 'featured posts'
        : 'loading feed';
  }

  function loadFeed() {
    fetch(blogOrigin + '/feed.xml')
      .then(function (response) {
        if (!response.ok) throw new Error('Feed request failed');
        return response.text();
      })
      .then(function (contents) {
        var parser = new DOMParser();
        var xml = parser.parseFromString(contents, 'text/xml');
        if (xml.querySelector('parsererror')) throw new Error('Invalid feed XML');
        var items = xml.querySelectorAll('item');
        if (!items.length) items = xml.querySelectorAll('entry');
        if (!items.length) throw new Error('Feed has no entries');

        var posts = [];
        for (var index = 0; index < Math.min(items.length, 4); index++) {
          var item = items[index];
          var title = item.querySelector('title');
          var itemLink = item.querySelector('link');
          var published = item.querySelector('pubDate') || item.querySelector('published') || item.querySelector('updated');
          var category = item.querySelector('category');
          var rawLink = itemLink ? (itemLink.getAttribute('href') || itemLink.textContent || '') : '';

          posts.push({
            tag: category ? (category.getAttribute('term') || category.textContent || '') : '',
            title: title ? title.textContent : '',
            date: published ? formatDate(published.textContent) : '',
            link: safeBlogUrl(rawLink)
          });
        }

        setPostsState('live');
        renderPosts(posts);
      })
      .catch(function () {
        setPostsState('fallback');
        renderPosts(fallbackPosts);
      });
  }

  loadFeed();

  /* Email copy: the mailto link keeps its default behavior; copying
     lives in a dedicated button next to it. */
  var emailCopyButton = document.getElementById('email-copy');
  var emailStatusEl = document.getElementById('email-status');
  var emailResetTimer = null;

  function showEmailStatus(buttonText, statusMessage) {
    window.clearTimeout(emailResetTimer);
    emailCopyButton.textContent = buttonText;
    if (emailStatusEl) emailStatusEl.textContent = statusMessage;
    emailResetTimer = window.setTimeout(function () {
      emailCopyButton.textContent = 'copy';
      if (emailStatusEl) emailStatusEl.textContent = '';
    }, 1800);
  }

  function fallbackCopyEmail(text) {
    var helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.className = 'clipboard-helper';
    document.body.appendChild(helper);
    helper.select();
    helper.setSelectionRange(0, helper.value.length);

    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }

    document.body.removeChild(helper);
    return copied;
  }

  if (emailCopyButton) {
    var emailAddress = emailCopyButton.getAttribute('data-email') || 'daniel@devploit.dev';

    var onEmailCopied = function () {
      showEmailStatus('copied', 'email address copied to clipboard');
    };

    var onEmailCopyFailed = function () {
      showEmailStatus('error', 'could not copy the email address');
    };

    emailCopyButton.addEventListener('click', function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(emailAddress)
          .then(onEmailCopied)
          .catch(function () {
            if (fallbackCopyEmail(emailAddress)) onEmailCopied();
            else onEmailCopyFailed();
          });
        return;
      }

      if (fallbackCopyEmail(emailAddress)) onEmailCopied();
      else onEmailCopyFailed();
    });
  }

  /* Dynamic GitHub stars, cached in localStorage to avoid refetching
     (and burning the 60 req/h unauthenticated API limit) on every visit. */
  var starRepos = [
    { repo: 'devploit/nomore403', selector: 'a[href*="nomore403"] .tool-badge' },
    { repo: 'devploit/awesome-ctf-resources', selector: 'a[href*="awesome-ctf-resources"] .tool-badge' },
    { repo: 'devploit/debugHunter', selector: 'a[href*="debugHunter"] .tool-badge' }
  ];
  var STAR_CACHE_KEY = 'devploit-star-cache-v1';
  var STAR_CACHE_TTL = 60 * 60 * 1000;

  function readStarCache() {
    try {
      var cache = JSON.parse(window.localStorage.getItem(STAR_CACHE_KEY));
      return cache && typeof cache === 'object' ? cache : {};
    } catch (error) {
      return {};
    }
  }

  function writeStarCache(cache) {
    try {
      window.localStorage.setItem(STAR_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {}
  }

  function applyStarDisplay(item, display) {
    var badge = document.querySelector(item.selector);
    if (badge) badge.textContent = display;
    var mirrors = document.querySelectorAll('[data-star-repo="' + item.repo + '"]');
    Array.prototype.forEach.call(mirrors, function (element) { element.textContent = display; });
  }

  var starCache = readStarCache();
  starRepos.forEach(function (item) {
    var cached = starCache[item.repo];
    if (cached && typeof cached.display === 'string') {
      applyStarDisplay(item, cached.display);
      if (Date.now() - cached.savedAt < STAR_CACHE_TTL) return;
    }

    fetch('https://api.github.com/repos/' + item.repo)
      .then(function (response) {
        if (!response.ok) throw new Error('GitHub request failed');
        return response.json();
      })
      .then(function (repository) {
        if (typeof repository.stargazers_count !== 'number') return;
        var count = repository.stargazers_count;
        var display = (count >= 1000 ? (Math.floor(count / 100) / 10) + 'k' : count) + ' ★';
        applyStarDisplay(item, display);
        starCache[item.repo] = { display: display, savedAt: Date.now() };
        writeStarCache(starCache);
      })
      .catch(function () {});
  });

  /* Easter egg: Kettle the duck */
  if (new URLSearchParams(window.location.search).get('pet') === '1') {
    var kettle = document.createElement('div');
    kettle.id = 'kettle';
    kettle.innerHTML =
      '<button id="kettle-close" aria-label="Close Kettle">&times;</button>' +
      '<pre>' +
      '  __\n' +
      '&lt;(o )___\n' +
      ' ( ._&gt; /\n' +
      '  `---´\n' +
      '</pre>' +
      '<span class="kettle-name">Kettle</span>' +
      '<span class="kettle-bubble">quack!</span>';
    document.body.appendChild(kettle);

    document.getElementById('kettle-close').addEventListener('click', function () {
      kettle.remove();
    });
  }
})();
