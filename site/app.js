// Short Cut download site — two small behaviours, no framework.
// 1. The travel-mode switch swaps the example route numbers.
// 2. A download click confirms that the file transfer started, because the
//    browser stays on this page while GitHub serves the APK.

const ROUTES = {
  ride: {
    shortDistance: '9.1 km',
    shortTime: '34 min',
    fastDistance: '10.2 km',
    fastTime: '29 min',
    deltaDistance: '1.1 km',
    deltaTime: '5 minutes',
  },
  walk: {
    shortDistance: '8.4 km',
    shortTime: '1 hr 46 min',
    fastDistance: '8.9 km',
    fastTime: '1 hr 39 min',
    deltaDistance: '0.5 km',
    deltaTime: '7 minutes',
  },
};

const setText = (selector, value) => {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
};

const modeButtons = Array.from(document.querySelectorAll('.segmented__btn'));

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    const route = ROUTES[mode];
    if (!route) return;

    modeButtons.forEach((other) => {
      const selected = other === button;
      other.classList.toggle('is-selected', selected);
      other.setAttribute('aria-pressed', String(selected));
    });

    setText('[data-short-distance]', route.shortDistance);
    setText('[data-short-time]', route.shortTime);
    setText('[data-fast-distance]', route.fastDistance);
    setText('[data-fast-time]', route.fastTime);
    setText('[data-delta-distance]', route.deltaDistance);
    setText('[data-delta-time]', route.deltaTime);
  });
});

// Download feedback -------------------------------------------------------

const status = document.createElement('p');
status.className = 'download-status';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
document.body.appendChild(status);

let statusTimer = 0;

document.querySelectorAll('[data-download]').forEach((link) => {
  link.addEventListener('click', () => {
    status.textContent = 'Download started. Check your browser downloads.';
    status.classList.add('is-visible');

    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.classList.remove('is-visible');
    }, 6000);
  });
});
