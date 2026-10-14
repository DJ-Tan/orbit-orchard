import sys
p='js/levels/w2.js'
s=open(p).read()
new=open(sys.argv[1]).read().rstrip()
tail='''    }
  ]
});
'''
assert s.endswith(tail)
s=s[:-len(tail)]+'    },\n'+new+'\n  ]\n});\n'
open(p,'w').write(s)
