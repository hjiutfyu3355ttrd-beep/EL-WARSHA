#!/usr/bin/env python3
# فاحص حماية: بيدوّر على ${...} جوه نصوص عادية ('...' أو "...") في ملفات JS.
# النص العادي مش بيقيّم ${} فبيظهر للمستخدم حرفياً (زي ${I18N.t("no_obs_points")} في قايمة).
# التشغيل من جذر المشروع قبل أي تسليم:   python3 tools/check-js-strings.py
# المفروض يطبع "REAL HITS: 0". لو طلّع مواضع: حوّل النص لـ '...' + I18N.t("key") + '...' أو استخدم قالب `...`.
import sys,glob
# محلّل مبسّط لـ JS: يلقط النصوص بين ' أو " (مش template) اللي فيها ${ — دي "بتتطبع حرفياً"
def scan(path):
    s=open(path,encoding='utf-8').read(); n=len(s); i=0; line=1; out=[]
    stack=[]  # لكل مستوى template: عمق الأقواس داخل ${ }
    def skip_string(q,i,line):
        j=i+1; start=line; buf=''
        while j<n:
            c=s[j]
            if c=='\\': j+=2; continue
            if c==q: return j+1,buf,line
            if c=='\n': return j,buf,line+1   # string مش مقفول (regex مثلاً)
            buf+=c; j+=1
        return j,buf,line
    in_tpl=False; depth=0
    # state machine
    mode=['code']; brace=[0]
    while i<n:
        c=s[i]
        m=mode[-1]
        if m=='code':
            if c=='\n': line+=1; i+=1; continue
            if c=='/' and s[i+1:i+2]=='/': 
                while i<n and s[i]!='\n': i+=1
                continue
            if c=='/' and s[i+1:i+2]=='*':
                j=s.index('*/',i+2); line+=s[i:j].count('\n'); i=j+2; continue
            if c in '\'"':
                j,buf,line2=skip_string(c,i,line)
                if '${' in buf: out.append((line,buf[:110]))
                i=j; line=line2; continue
            if c=='`': mode.append('tpl'); i+=1; continue
            if c=='{': brace[-1]+=1
            if c=='}':
                if brace[-1]==0 and len(mode)>1 and mode[-2]=='tpl_expr_marker': pass
                brace[-1]-=1
                if brace[-1]<0 and len(mode)>1:
                    mode.pop(); brace.pop(); i+=1; continue   # رجعنا من ${ } لتيمبلت
            i+=1; continue
        if m=='tpl':
            if c=='\\': i+=2; continue
            if c=='\n': line+=1
            if c=='`': mode.pop(); i+=1; continue
            if c=='$' and s[i+1:i+2]=='{':
                mode.append('code'); brace.append(0); i+=2; continue
            i+=1; continue
    return out
tot=0
for f in sorted(glob.glob('js/*.js')+glob.glob('js/pages/*.js')):
    for line,txt in scan(f):
        print(f,line,txt); tot+=1
print('REAL HITS:',tot)
