import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = __dirname;

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'app.css'), 'utf8');
const jsFiles = [
  'vendor-core.js',
  'app-part-a.js',
  'app-part-b.js',
  'app-part-c.js',
  'app-part-d.js',
  'app-part-e.js',
  'cloud-sync.js',
];
const js = jsFiles.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

html = html.replace('<link rel="stylesheet" href="app.css">', () => `<style>\n${css}\n</style>`);

const supabaseCdn =
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.min.js"></script>';

const scriptRe = new RegExp(
  String.raw`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/dist/umd/supabase.min.js"></script>\s*` +
    String.raw`<script src="vendor-core.js"></script>\s*` +
    String.raw`<script src="app-part-a.js"></script>\s*` +
    String.raw`<script src="app-part-b.js"></script>\s*` +
    String.raw`<script src="app-part-c.js"></script>\s*` +
    String.raw`<script src="app-part-d.js"></script>\s*` +
    String.raw`<script src="app-part-e.js"></script>\s*` +
    String.raw`<script src="cloud-sync.js"></script>`,
  'm'
);

if (!scriptRe.test(html)) {
  throw new Error('Could not find script block pattern in index.html');
}

// Callback avoids replace() treating $' / $& in injected JS as substitution patterns
html = html.replace(scriptRe, () => `${supabaseCdn}\n<script>\n${js}\n</script>`);

const out = path.join(dir, 'index-standalone.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out, 'size', html.length);

const headNote =
  '\n<!--\n' +
  '  ניהול משפחתי — קובץ HTML יחיד מלא ועצמאי (כל ה־CSS וה־JavaScript מוטמעים בקובץ).\n' +
  '  • פתיחה מקומית: לחיצה כפולה (חלק מהדפדפנים מגבילים file:// — אז שרת סטטי או העלאה ל־HTTPS).\n' +
  '  • PWA מלא: העלו את הקובץ הזה לאתר יחד עם sw.js מתיקיית distribution.\n' +
  '  • לעדכן את העותק: הריצו שוב node build-standalone.mjs אחרי שינויי קוד.\n' +
  '-->\n';
const htmlFullBundle = html.replace('<head>', '<head>' + headNote);
const outFull = path.join(dir, 'ניהול-משפחתי-מלא.html');
fs.writeFileSync(outFull, htmlFullBundle, 'utf8');
console.log('Wrote', outFull, 'size', htmlFullBundle.length);

const dist = path.join(dir, 'distribution');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');
fs.copyFileSync(path.join(dir, 'sw.js'), path.join(dist, 'sw.js'));

const readmeDist = path.join(dist, 'README.txt');
const readmeText = `ניהול משפחתי — ערכת הפצה
========================

מה יש כאן
----------
• index.html  — האפליקציה המלאה (קובץ אחד, אפשר לפתוח גם כפולה-קליק).
• sw.js       — לעבודה ללא רשת אחרי ביקור ראשון בכתובת https (אופציונלי).

פרטיות
-------
אין שרת של האפליקציה. הנתונים נשמרים רק במכשיר שלכם.
סנכרון בין טלפונים: אופציונלי Supabase (הגדרות) או «גיבוי בין מכשירים» → קובץ.

העלאה לאתר (Vercel / Netlify וכו׳)
---------------------------
העלו את שני הקבצים (index.html + sw.js) לאותה תיקייה בשרת.
פתחו את כתובת האתר בטלפון, הוסיפו למסך הבית.

`;
fs.writeFileSync(readmeDist, readmeText, 'utf8');

const readmeRoot = path.join(dir, 'README-מבנה-הפרויקט.txt');
const readmeRootText = `ניהול משפחתי — מבנה תיקייה
============================

distribution\\     ← מה שמפיצים / מעלים לאתר: index.html + sw.js + README
index-standalone.html  ← עותק מאוחד (זהה ל-distribution\\index.html)
ניהול-משפחתי-מלא.html  ← אותו תוכן + הסבר בראש ה־HTML (קובץ יחיד עצמאי)
index.html, app.css, vendor-core.js, app-part-*.js, cloud-sync.js  ← מקור לפיתוח
supabase/schema.sql  ← טבלת כספת + RLS (הרצה ב-Supabase SQL Editor)
vercel.json, package.json  ← פריסה ל-Vercel (npm run build)
מדריך-פריסה-סופבייס-ורסל.txt  ← צעדים מלאים
build-standalone.mjs  ← הרצה: node build-standalone.mjs או npm run build

`;
fs.writeFileSync(readmeRoot, readmeRootText, 'utf8');
console.log('Wrote', dist, '(index.html + sw.js + README.txt)');
