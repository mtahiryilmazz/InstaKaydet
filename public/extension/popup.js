document.getElementById('openWebBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ais-dev-g73will3ywffa5z3z24vnr-79347650064.europe-west2.run.app' });
});

document.getElementById('guideBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.instagram.com/' });
});
