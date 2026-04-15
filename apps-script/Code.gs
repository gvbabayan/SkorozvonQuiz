// Google Apps Script — Skorozvon Quiz API
// Задеплоить как Web App: Выполнить от имени "Я", доступ "Все"
//
// Структура таблицы:
//   Лист "Вопросы":  A=Вопрос, B=Вар.A, C=Вар.B, D=Вар.C, E=Вар.D, F=Ответ (A/B/C/D)
//   Лист "Результаты": A=Дата, B=Логин, C=Баллы, D=Сдал, E=Ответы

var SPREADSHEET_ID  = '1KBBM4wcf-jTbTi5x35Arbamd8fqTaJwUPvgsTIrsMUI';
var QUESTIONS_SHEET = 'Вопросы';
var RESULTS_SHEET   = 'Результаты';
var QUESTIONS_COUNT = 10;

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  if (action === 'questions') {
    return getQuestions();
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    return saveResult(data);
  } catch (err) {
    return jsonResponse({ error: err.message }, 400);
  }
}

function getQuestions() {
  var ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet  = ss.getSheetByName(QUESTIONS_SHEET);
  var rows   = sheet.getDataRange().getValues();

  // Пропускаем заголовок (первая строка)
  var data = rows.slice(1).filter(function(r) { return r[0]; });

  // Перемешиваем и берём нужное количество
  var shuffled = shuffleArray(data).slice(0, QUESTIONS_COUNT);

  var questions = shuffled.map(function(row, i) {
    return {
      id:       i,
      question: row[0],
      options: {
        A: row[1],
        B: row[2],
        C: row[3],
        D: row[4]
      },
      answer: row[5].toString().trim().toUpperCase()
    };
  });

  return jsonResponse({ questions: questions });
}

function saveResult(data) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(RESULTS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(RESULTS_SHEET);
    sheet.appendRow(['Дата', 'Логин', 'Баллы', 'Сдал', 'Ответы']);
  }

  var now     = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
  var passed  = data.score >= 8 ? 'Да' : 'Нет';
  var answers = JSON.stringify(data.answers || []);

  sheet.appendRow([dateStr, data.login || '—', data.score + '/10', passed, answers]);

  return jsonResponse({ ok: true, passed: data.score >= 8 });
}

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function jsonResponse(obj, code) {
  var output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
