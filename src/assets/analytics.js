(function () {
  'use strict';

  function track(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    }
  }

  function closest(target, selector) {
    return target && target.closest ? target.closest(selector) : null;
  }

  document.addEventListener('click', function (event) {
    var link = closest(event.target, 'a');
    if (link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('tel:') === 0) track('phone_click', { link_url: href });
      if (/request-access|contact|schedule|cal\.com/i.test(href)) {
        track(/schedule|cal\.com/i.test(href) ? 'schedule_call' : 'contact_advisor', { link_url: href });
      }
      if (/\.(pdf|docx?|xlsx?|csv)(\?|$)/i.test(href)) {
        track('file_download', { file_name: href.split('/').pop().split('?')[0], link_url: href });
      }
      if (/(offering|dst|1031|property).*\.html/i.test(href)) {
        track('offering_view', { link_url: href });
      }
    }

    if (closest(event.target, '[data-analytics-event]')) {
      var el = closest(event.target, '[data-analytics-event]');
      track(el.getAttribute('data-analytics-event'), { page_path: location.pathname });
    }

    if (closest(event.target, '.calculator, [id*="Calc" i], [id*="calculator" i], button')) {
      var label = (event.target.textContent || '').trim().slice(0, 80);
      if (/calculate|continue|run|estimate|see my recommendation|reset/i.test(label)) {
        track('calculator_use', { control: label, page_path: location.pathname });
      }
    }
  }, false);

  document.addEventListener('submit', function (event) {
    var form = event.target;
    var label = (form.id || form.getAttribute('name') || form.className || '').toString();
    track(/request|access|investor|registration/i.test(label) ? 'request_access' : 'form_submit', {
      form_name: label || 'unnamed',
      page_path: location.pathname
    });
  }, false);

  if (/\/account\.html$/i.test(location.pathname)) {
    track('portal_login', { page_path: location.pathname });
  }
}());
