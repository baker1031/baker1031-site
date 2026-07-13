(function () {
  'use strict';

  var pending = window.__b1031PendingAnalytics || (window.__b1031PendingAnalytics = []);

  function track(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    }
  }

  function once(name, params, key) {
    var marker = 'b1031-ga4:' + (key || name);
    try {
      if (window.sessionStorage && sessionStorage.getItem(marker)) return false;
      if (window.sessionStorage) sessionStorage.setItem(marker, '1');
    } catch (e) {}
    track(name, params);
    return true;
  }

  window.b1031Analytics = window.b1031Analytics || {};
  window.b1031Analytics.track = track;
  window.b1031Analytics.once = once;

  function drainPending() {
    while (pending.length) {
      var item = pending.shift();
      if (item && item.name) track(item.name, item.params || {});
    }
  }

  function trackPortalLogin() {
    if (window.__b1031PortalLoginTracked) return;
    window.__b1031PortalLoginTracked = true;
    track('login', { method: 'Clerk', page_path: location.pathname });
    track('portal_login', { method: 'Clerk', page_path: location.pathname });
  }

  function trackOfferingPageView() {
    var dataNode = document.getElementById('offering-data');
    if (!dataNode) return;
    var data;
    try { data = JSON.parse(dataNode.textContent || '{}'); } catch (e) { return; }
    var slug = location.pathname.split('/').pop().replace(/\.html$/i, '') || 'offering';
    var name = data.investmentName || document.title.replace(/\s*\|\s*Baker 1031 Investments\s*$/i, '');
    var item = {
      item_id: slug,
      item_name: name,
      item_category: '1031 exchange offering',
      item_brand: data.sponsor || 'Baker 1031 Investments'
    };
    once('view_item', {
      currency: 'USD',
      items: [item],
      page_path: location.pathname
    }, 'view_item:' + location.pathname);
    once('investment_page_view', {
      investment_name: name,
      investment_slug: slug,
      sponsor: data.sponsor || '',
      property_type: data.propertyType || '',
      status: data.status || '',
      page_path: location.pathname
    }, 'investment_page_view:' + location.pathname);
  }

  function trackDirectoryView() {
    if (/\/investments\.html$/i.test(location.pathname)) {
      once('investment_directory_view', { page_path: location.pathname }, 'investment_directory_view:' + location.pathname);
    }
  }

  function closest(target, selector) {
    return target && target.closest ? target.closest(selector) : null;
  }

  function safeLink(href) {
    href = String(href || '');
    if (/^tel:/i.test(href)) return 'tel:';
    try {
      var url = new URL(href, location.href);
      return url.origin + url.pathname;
    } catch (e) {
      return href.split(/[?#]/)[0];
    }
  }

  document.addEventListener('click', function (event) {
    var link = closest(event.target, 'a');
    if (link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('tel:') === 0) track('phone_click', { link_url: safeLink(href) });
      if (/request-access|contact|schedule|cal\.com/i.test(href)) {
        track(/schedule|cal\.com/i.test(href) ? 'schedule_call' : 'contact_advisor', { link_url: safeLink(href) });
      }
      if (/\.(pdf|docx?|xlsx?|csv)(\?|$)/i.test(href)) {
        track('file_download', { file_name: safeLink(href).split('/').pop(), link_url: safeLink(href) });
      }
      if (/(offering|dst|1031|property).*\.html/i.test(href)) {
        track('offering_view', { link_url: safeLink(href), page_path: location.pathname });
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

  window.addEventListener('b1031:portal-login', trackPortalLogin, false);
  if (window.__b1031PortalAuthenticated) trackPortalLogin();
  drainPending();
  trackOfferingPageView();
  trackDirectoryView();
}());
