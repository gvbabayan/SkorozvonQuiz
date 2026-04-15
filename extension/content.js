var PASS_SCORE   = 8;   // минимум правильных из 10
var TOTAL_Q      = 10;

var employeeLogin = '';
var questions     = [];
var current       = 0;
var score         = 0;
var answers       = [];

// ─── Точка входа ───────────────────────────────────────────────────────────

function init() {
  captureLogin();
  showOverlay();
  loadQuestions();
}

// ─── Перехват логина со страницы ────────────────────────────────────────────

function captureLogin() {
  // Skorozvon использует input[type=text] или input[type=email] для логина
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (
      el.tagName === 'INPUT' &&
      (el.type === 'text' || el.type === 'email' || el.name === 'login' || el.name === 'email')
    ) {
      employeeLogin = el.value.trim();
    }
  }, true);
}

// ─── Оверлей ────────────────────────────────────────────────────────────────

function showOverlay() {
  var overlay = document.createElement('div');
  overlay.id  = 'skz-overlay';
  overlay.innerHTML = [
    '<div id="skz-card">',
      '<div id="skz-header">',
        '<p id="skz-title">Ежедневный тест</p>',
        '<span id="skz-counter"></span>',
      '</div>',
      '<div id="skz-progress-wrap"><div id="skz-progress-bar"></div></div>',
      '<div id="skz-loading">',
        '<div class="skz-spinner"></div>',
        'Загружаем вопросы…',
      '</div>',
    '</div>'
  ].join('');

  document.body.appendChild(overlay);

  // Блокируем скролл страницы под оверлеем
  document.body.style.overflow = 'hidden';
}

function getCard()    { return document.getElementById('skz-card');         }
function getLoading() { return document.getElementById('skz-loading');      }
function getProgress(){ return document.getElementById('skz-progress-bar'); }
function getCounter() { return document.getElementById('skz-counter');      }

// ─── Загрузка вопросов ──────────────────────────────────────────────────────

function loadQuestions() {
  chrome.runtime.sendMessage({ type: 'getQuestions' }, function(resp) {
    if (resp && resp.ok && resp.data.questions && resp.data.questions.length) {
      questions = resp.data.questions;
      renderQuestion(0);
    } else {
      showError('Не удалось загрузить вопросы. Обратитесь к руководителю.');
    }
  });
}

// ─── Отображение вопроса ────────────────────────────────────────────────────

function renderQuestion(index) {
  var q    = questions[index];
  var card = getCard();

  getProgress().style.width = ((index / TOTAL_Q) * 100) + '%';
  getCounter().textContent  = (index + 1) + ' / ' + TOTAL_Q;

  var optionsHTML = ['A','B','C','D'].map(function(letter) {
    return [
      '<button class="skz-option" data-letter="' + letter + '">',
        '<span class="skz-option-letter">' + letter + '</span>',
        '<span>' + escHtml(q.options[letter]) + '</span>',
      '</button>'
    ].join('');
  }).join('');

  // Заменяем содержимое карточки (кроме шапки и прогресс-бара)
  var loading = getLoading();
  if (loading) loading.remove();

  // Убираем старый вопрос если есть
  var oldQ = card.querySelector('#skz-question');
  var oldO = card.querySelector('#skz-options');
  if (oldQ) oldQ.remove();
  if (oldO) oldO.remove();

  var qEl = document.createElement('div');
  qEl.id  = 'skz-question';
  qEl.textContent = q.question;

  var oEl = document.createElement('div');
  oEl.id  = 'skz-options';
  oEl.innerHTML = optionsHTML;

  card.appendChild(qEl);
  card.appendChild(oEl);

  // Навешиваем обработчики
  oEl.querySelectorAll('.skz-option').forEach(function(btn) {
    btn.addEventListener('click', function() {
      onAnswer(btn.dataset.letter, q.answer, index);
    });
  });
}

// ─── Обработка ответа ───────────────────────────────────────────────────────

function onAnswer(chosen, correct, index) {
  var oEl = document.getElementById('skz-options');

  // Блокируем все кнопки
  oEl.querySelectorAll('.skz-option').forEach(function(btn) {
    btn.disabled = true;
    if (btn.dataset.letter === correct) btn.classList.add('correct');
    if (btn.dataset.letter === chosen && chosen !== correct) btn.classList.add('wrong');
    if (btn.dataset.letter === chosen) btn.classList.add('selected');
  });

  var isCorrect = chosen === correct;
  if (isCorrect) score++;
  answers.push({ q: index, chosen: chosen, correct: correct, ok: isCorrect });

  // Переход к следующему вопросу
  setTimeout(function() {
    current = index + 1;
    if (current < TOTAL_Q) {
      renderQuestion(current);
    } else {
      submitResult();
    }
  }, 800);
}

// ─── Отправка результата ────────────────────────────────────────────────────

function submitResult() {
  getProgress().style.width = '100%';

  var payload = {
    login:   employeeLogin || 'неизвестен',
    score:   score,
    passed:  score >= PASS_SCORE,
    answers: answers
  };

  chrome.runtime.sendMessage({ type: 'saveResult', payload: payload }, function() {
    showResult(score >= PASS_SCORE);
  });
}

// ─── Экран результата ───────────────────────────────────────────────────────

function showResult(passed) {
  var card = getCard();

  // Очищаем карточку
  card.innerHTML = '';

  var icon    = passed ? '✅' : '❌';
  var heading = passed ? 'Тест пройден!' : 'Тест не пройден';
  var msgClass = passed ? 'success' : 'error';
  var msgText  = passed
    ? 'Отлично! Вы можете начать работу.'
    : 'Вы набрали меньше 8 из 10 правильных ответов. Доступ заблокирован до завтра.';

  card.innerHTML = [
    '<div id="skz-result" class="' + (passed ? 'passed' : 'failed') + '">',
      '<div class="skz-result-icon">' + icon + '</div>',
      '<h2>' + heading + '</h2>',
      '<p class="skz-score-text">Правильных ответов: <strong>' + score + ' / ' + TOTAL_Q + '</strong></p>',
      '<div class="skz-msg ' + msgClass + '">' + msgText + '</div>',
    '</div>'
  ].join('');

  if (passed) {
    // Убираем оверлей через 2 секунды
    setTimeout(function() {
      var overlay = document.getElementById('skz-overlay');
      if (overlay) overlay.remove();
      document.body.style.overflow = '';
    }, 2000);
  }
  // Если не прошёл — оверлей остаётся, логин недоступен
}

// ─── Ошибка загрузки ────────────────────────────────────────────────────────

function showError(msg) {
  var loading = getLoading();
  if (loading) {
    loading.innerHTML = '<div class="skz-msg error">' + escHtml(msg) + '</div>';
  }
}

// ─── Утилита ────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Запуск ─────────────────────────────────────────────────────────────────

// SPA — ждём появления формы логина (Skorozvon подгружает форму динамически)
function waitForLoginPage() {
  var found = false;

  var observer = new MutationObserver(function() {
    if (!found && document.querySelector('input[type="text"], input[type="email"]')) {
      found = true;
      observer.disconnect();
      init();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // На случай если форма уже есть
  if (document.querySelector('input[type="text"], input[type="email"]')) {
    found = true;
    init();
  }
}

waitForLoginPage();
