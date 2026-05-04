/**
 * ניהול משפחתי — סנכרון תנועות לגוגל שיטס
 * ----------------------------------------
 * 1. פתחו גיליון חדש ב-Google Sheets.
 * 2. הרחבו: הרחבה > Apps Script.
 * 3. הדביקו את הקובץ הזה (או את התוכן שלו) ועדכנו את הקבועים למטה.
 * 4. פריסה: פרוס > פריסה חדשה > סוג: אפליקציית אינטרנט
 *    - הרץ כ: אני
 *    - מי יכול לגשת: כל אחד
 * 5. העתיקו את כתובת ה-Web App (מסתיימת ב-/exec) להגדרות האפליקציה.
 *
 * אבטחה: כל מי שיש לו את ה-URL יכול לשלוח נתונים. מומלץ להגדיר SHARED_SECRET
 * ואותו ערך בשדה «מפתח סודי» בהגדרות האפליקציה.
 */
var SPREADSHEET_ID = 'הדביקו_כאן_את_ID_של_הגיליון';
var SHEET_NAME = 'Transactions';
var SHARED_SECRET = ''; // לדוגמה 'my-family-secret' — חייב להתאים להגדרות באפליקציה

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (SHARED_SECRET && String(data.secret || '') !== SHARED_SECRET) {
      return textOut('forbidden', 403);
    }
    var list = data.transactions || [];
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SHEET_NAME);
      sh.appendRow([
        'id', 'date', 'type', 'status', 'amount', 'currency',
        'category', 'account', 'toAccount', 'description',
        'paymentMethod', 'tag', 'notes', 'updatedAt', 'deviceId'
      ]);
    }
    var existing = {};
    var last = sh.getLastRow();
    if (last > 1) {
      var ids = sh.getRange(2, 1, last, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0]) existing[String(ids[i][0])] = true;
      }
    }
    var added = 0;
    var skipped = 0;
    for (var j = 0; j < list.length; j++) {
      var tx = list[j];
      var id = String(tx.id || '');
      if (!id || existing[id]) {
        skipped++;
        continue;
      }
      existing[id] = true;
      sh.appendRow([
        id,
        tx.date || '',
        tx.type || '',
        tx.status || '',
        tx.amount,
        tx.currency || '',
        tx.category || '',
        tx.account || '',
        tx.toAccount || '',
        tx.description || '',
        tx.paymentMethod || '',
        tx.tag || '',
        tx.notes || '',
        tx.updatedAt || '',
        data.deviceId || ''
      ]);
      added++;
    }
    return textOut('OK: נוספו ' + added + ', דולגו קיימים ' + skipped, 200);
  } catch (err) {
    return textOut(String(err), 500);
  }
}

/** בדיקה מהדפדפן: פתחו את כתובת ה-Web App בלי POST */
function doGet() {
  return textOut('SheetsSync פעיל — השתמשו ב-POST מהאפליקציה', 200);
}

function textOut(message, code) {
  var out = ContentService.createTextOutput(message);
  out.setMimeType(ContentService.MimeType.TEXT);
  // Apps Script Web App מחזיר 200 כברירת מחדל; ה-code אינו ממופה תמיד ל-HTTP
  return out;
}
