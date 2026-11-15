import json, numpy as np, sys, os
MH = sys.argv[1] if len(sys.argv)>1 else 'mh'
def load_obj(p):
    V=[];F=[];g=None
    for l in open(p):
        if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('g '): g=l.split()[1]
        elif l.startswith('f ') and g=='body': F.append([int(t.split('/')[0])-1 for t in l.split()[1:]])
    return np.array(V), F
def load_target(p):
    d=[]
    for l in open(p):
        if l.startswith('#') or not l.strip(): continue
        a=l.split(); d.append((int(a[0]),float(a[1]),float(a[2]),float(a[3])))
    return d
def shaped(mh, mix):
    V,F=load_obj(os.path.join(mh,'base.obj'))
    for name,w in mix:
        for i,x,y,z in load_target(os.path.join(mh,name+'.target')):
            V[i]+= w*np.array([x,y,z])
    return V,F
