(function () {
  var form = document.getElementById('subscribe-form');
  if (!form) return;

  var config = window.SITE_CONFIG || {};
  var pubId = config.beehiivPublicationId;
  var utm = config.subscribeUtm || {};
  var status = document.getElementById('subscribe-status');
  var submitBtn = form.querySelector('button[type="submit"]');

  if (pubId) {
    form.action = 'https://embeds.beehiiv.com/' + pubId + '/subscribe';
    form.method = 'post';
  }

  form.addEventListener('submit', function (e) {
    if (!pubId) {
      e.preventDefault();
      if (status) {
        status.textContent = 'Newsletter signup is being configured. Email me@alekseibalchunas.com for the guide.';
        status.className = 'subscribe-status err';
      }
      return;
    }

    e.preventDefault();
    if (submitBtn) submitBtn.disabled = true;

    var email = form.email.value.trim();
    var body = new URLSearchParams();
    body.set('email', email);
    if (utm.source) body.set('utm_source', utm.source);
    if (utm.medium) body.set('utm_medium', utm.medium);
    if (utm.campaign) body.set('utm_campaign', utm.campaign);

    fetch(form.action, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }).finally(function () {
      if (status) {
        status.textContent = 'Check your inbox — the PDF arrives with your welcome email from Two Exits Later.';
        status.className = 'subscribe-status ok';
      }
      form.reset();
      if (submitBtn) submitBtn.disabled = false;
    });
  });
})();
