// Service worker — проксирует запросы к Google Apps Script
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbygObWcVxX9ZtlnJB1k_A5QTHkTkEbh4Z-plDg7jnYLQ71i15cVHHABakdFvoWeUI1T/exec';

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'getQuestions') {
    fetch(APPS_SCRIPT_URL + '?action=questions')
      .then(function(r) { return r.json(); })
      .then(function(data) { sendResponse({ ok: true, data: data }); })
      .catch(function(e) { sendResponse({ ok: false, error: e.message }); });
    return true; // async response
  }

  if (msg.type === 'saveResult') {
    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg.payload),
      redirect: 'follow'
    })
      .then(function(r) { return r.json(); })
      .then(function(data) { sendResponse({ ok: true, data: data }); })
      .catch(function(e) { sendResponse({ ok: false, error: e.message }); });
    return true;
  }
});
