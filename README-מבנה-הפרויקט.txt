ניהול משפחתי — מבנה תיקייה
============================

distribution\     ← מה שמפיצים / מעלים לאתר: index.html + sw.js + README
index-standalone.html  ← עותק מאוחד (זהה ל-distribution\index.html)
ניהול-משפחתי-מלא.html  ← אותו תוכן + הסבר בראש ה־HTML (קובץ יחיד עצמאי)
index.html, app.css, vendor-core.js, app-part-*.js, cloud-sync.js  ← מקור לפיתוח
supabase/schema.sql  ← טבלת כספת + RLS (הרצה ב-Supabase SQL Editor)
vercel.json, package.json  ← פריסה ל-Vercel (npm run build)
מדריך-פריסה-סופבייס-ורסל.txt  ← צעדים מלאים
build-standalone.mjs  ← הרצה: node build-standalone.mjs או npm run build

