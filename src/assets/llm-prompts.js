(function () {
  'use strict';
  document.querySelectorAll('[data-copy-prompt]').forEach(function (button) {
    button.addEventListener('click', function () {
      var card = button.closest('[data-llm]');
      var prompt = card && card.querySelector('.llm-prompt');
      var message = card && card.querySelector('.llm-copied');
      if (!prompt) return;
      var done = function () { if (message) message.textContent = 'Copied'; setTimeout(function () { if (message) message.textContent = ''; }, 1800); if (window.b1031Analytics) window.b1031Analytics.track('llm_prompt_copy', { provider: card.getAttribute('data-llm') }); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt.value).then(done).catch(function () { prompt.select(); document.execCommand('copy'); done(); });
      else { prompt.select(); document.execCommand('copy'); done(); }
    });
  });
}());
