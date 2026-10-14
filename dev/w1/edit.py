import sys, json
p='js/levels/w1.js'; s=open(p).read()
def edit(lid, pairs):
    global s
    a=s.index('id: "%s"'%lid); b=s.find('id: "w1-',a+5); b=len(s) if b<0 else b
    seg=s[a:b]
    for o,n in pairs:
        assert o in seg,(lid,o); seg=seg.replace(o,n)
    s=s[:a]+seg+s[b:]
exec(sys.stdin.read())
open(p,'w').write(s)
