"""Inline zenon.css and zenon.js into a single page (used for the claude.ai preview)."""
import sys
s = open('index.html').read()
head = s.split('<!--PREVIEW-START-->')[1].split('<!--PREVIEW-HEAD-END-->')[0]
body = s.split('<!--PREVIEW-BODY-START-->')[1].split('<!--PREVIEW-BODY-END-->')[0]
head = head.replace('<link rel="stylesheet" href="zenon.css">', '<style>' + open('zenon.css').read() + '</style>')
body = body.replace('<script src="zenon-care.js"></script>', '<script>' + open('zenon-care.js', encoding='utf-8').read() + '</script>')
for js in ('zenon-plan.js', 'zenon-coach.js'):
    body = body.replace('<script src="' + js + '"></script>', '<script>' + open(js, encoding='utf-8').read() + '</script>')
body = body.replace('<script src="zenon.js"></script>', '<script>' + open('zenon.js', encoding='utf-8').read() + '</script>')
open(sys.argv[1] if len(sys.argv) > 1 else 'preview.html', 'w').write(head + body)
