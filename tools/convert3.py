# Build a compact skinned human asset from MakeHuman CC0 data.
import sys, json, gzip, base64, struct, numpy as np
sys.path.insert(0, sys.argv[2]); from load import *
mh, outp = sys.argv[1], sys.argv[3]
MIX=[('caucasian-male-young',1/3),('african-male-young',1/3),('asian-male-young',1/3),
     ('universal-male-young-maxmuscle-averageweight',0.5),
     ('male-young-averagemuscle-averageweight-idealproportions',0.8)]
V,F=shaped(mh,MIX)
S=json.load(open(mh+'/default.mhskel')); B=S['bones']
J={k:V[v].mean(0) for k,v in S['joints'].items()}
W=json.load(open(mh+'/default_weights.mhw'))['weights']
def H(n): return J[B[n]['head']]
def T(n): return J[B[n]['tail']]

# kept bones: name -> (parent, head, tail)
K={}
def keep(n,p,h,t): K[n]=(p,np.array(h),np.array(t))
keep('hips',None,H('root'),T('root'))
prev='hips'
for s in ['spine05','spine04','spine03','spine02','spine01']:
    keep(s,prev,H(s),T(s)); prev=s
keep('neck','spine01',H('neck01'),T('neck03'))
keep('head','neck',H('head'),T('head'))
for sd in 'LR':
    keep('clavicle.'+sd,'spine01',H('clavicle.'+sd),T('shoulder01.'+sd))
    keep('upperarm.'+sd,'clavicle.'+sd,H('upperarm01.'+sd),T('upperarm02.'+sd))
    keep('forearm.'+sd,'upperarm.'+sd,H('lowerarm01.'+sd),T('lowerarm02.'+sd))
    keep('hand.'+sd,'forearm.'+sd,H('wrist.'+sd),T('metacarpal2.'+sd))
    for f in range(1,6):
        par='hand.'+sd
        for k in range(1,4):
            n='finger%d-%d.%s'%(f,k,sd); keep(n,par,H(n),T(n)); par=n
    keep('thigh.'+sd,'hips',H('upperleg01.'+sd),T('upperleg02.'+sd))
    keep('shin.'+sd,'thigh.'+sd,H('lowerleg01.'+sd),T('lowerleg02.'+sd))
    keep('foot.'+sd,'shin.'+sd,H('foot.'+sd),np.mean([H('toe%d-1.%s'%(i,sd)) for i in range(1,6)],0))
    th=np.mean([H('toe%d-1.%s'%(i,sd)) for i in range(1,6)],0)
    keep('toes.'+sd,'foot.'+sd,th,np.mean([T('toe%d-3.%s'%(i,sd)) if 'toe%d-3.%s'%(i,sd) in B else T('toe%d-2.%s'%(i,sd)) for i in range(1,6)],0))

def mapbone(n):
    if n in K: return n
    sd=n[-1] if n[-2:] in ('.L','.R') else ''
    base=n[:-2] if sd else n
    m={'root':'hips','pelvis':'hips','neck01':'neck','neck02':'neck','neck03':'neck','shoulder01':'clavicle',
       'upperarm01':'upperarm','upperarm02':'upperarm','lowerarm01':'forearm','lowerarm02':'forearm','wrist':'hand',
       'upperleg01':'thigh','upperleg02':'thigh','lowerleg01':'shin','lowerleg02':'shin','breast':None}
    if base.startswith('metacarpal'): return 'hand.'+sd
    if base.startswith('toe'): return 'toes.'+sd
    if base=='breast': return 'spine02'
    if base=='pelvis': return 'hips'
    if base in m and m[base]: return m[base]+('.'+sd if sd else '')
    # walk to ancestor
    p=B[n]['parent']
    return mapbone(p)
names=list(K.keys()); idx={n:i for i,n in enumerate(names)}
used=sorted(set(i for f in F for i in f)); remap={v:i for i,v in enumerate(used)}; N=len(used)
acc=[dict() for _ in range(N)]
for bn,lst in W.items():
    kb=idx[mapbone(bn)]
    for vi,w in lst:
        if vi in remap:
            d=acc[remap[vi]]; d[kb]=d.get(kb,0)+w
SI=np.zeros((N,4),np.uint8); SW=np.zeros((N,4),np.float64); dom=np.zeros(N,int)
for i,d in enumerate(acc):
    if not d: d={0:1.0}
    it=sorted(d.items(),key=lambda x:-x[1])[:4]; s=sum(w for _,w in it)
    for k,(b,w) in enumerate(it): SI[i,k]=b; SW[i,k]=w/s
    dom[i]=it[0][0]
P=V[used].copy()
tris=[]
for f in F:
    g=[remap[i] for i in f]
    if len(g)==4: tris += [(g[0],g[1],g[2]),(g[0],g[2],g[3])]
    else: tris.append(tuple(g))
tris=np.array(tris)
from scipy.spatial import ConvexHull, cKDTree
WB=np.zeros((N,len(names)))
for i,d in enumerate(acc):
    for b,w in d.items(): WB[i,b]+=w
WB/=WB.sum(1,keepdims=True)+1e-9
def grp(pred): return WB[:,[k for k,n in enumerate(names) if pred(n)]].sum(1)
arm=grp(lambda n:n.startswith(('upperarm','forearm','hand','finger')))
fore=grp(lambda n:n.startswith(('forearm','hand','finger')))
leg=grp(lambda n:n.startswith(('thigh','shin','foot','toes')))
headw=grp(lambda n:n=='head')
X,Y,Z=P[:,0],P[:,1],P[:,2]
def sm(x,w): return np.clip(0.5+x/w,0,1)
hipY=K['thigh.L'][1][1]; kneeY=K['shin.L'][1][1]; ankY=K['foot.L'][1][1]; floorY=Y.min()
eyeL=J['eye.L____head']; eyeR=J['eye.R____head']; eyeY=eyeL[1]
neckY=K['neck'][1][1]
waistY=hipY+0.62*(K['spine04'][1][1]-hipY)+0.45
def along(bone):
    t=np.zeros(N)
    for sd,mask in (('L',X>=0),('R',X<0)):
        h=K[bone+'.'+sd][1]; a=K[bone+'.'+sd][2]-h
        t[mask]=((P[mask]-h)@a)/(a@a)
    return t
tArm=along('upperarm'); tLeg=along('thigh')
# collar (crew neck): skin above this line near the neck
fr=np.clip((Z-0.1)/0.5,0,1)
cy=neckY-0.30-0.42*fr*np.clip(1-np.abs(X)/0.85,0,1)**0.7
collar=sm(Y-cy,0.2)*sm(0.98-np.abs(X),0.2)
waistF=sm(Y-waistY,0.6)
torsoShirt=waistF*(1-collar)
sleeve=sm(0.46-tArm,0.12)
shirt=np.clip((1-arm)*(1-leg)*torsoShirt+(arm-fore)*np.maximum(sleeve,0)*(1-collar),0,1)
shortsLeg=sm(0.50-tLeg,0.14)
shorts=np.clip((1-arm)*(1-leg)*(1-waistF)+leg*shortsLeg,0,1)
# hair: spherical coords around the head centre
hv=headw>0.5
C=np.array([0,P[hv,1].mean()+0.15,P[hv,2].mean()-0.15])
U=P-C; r=np.linalg.norm(U,axis=1)+1e-9
el=np.degrees(np.arcsin(U[:,1]/r)); az=np.abs(np.degrees(np.arctan2(U[:,0],U[:,2])))
thr=np.interp(az,[0,25,45,70,95,120,180],[58,55,46,31,18,6,-17])
hair=headw*sm(el-thr,9.0)
# brows
brow=np.zeros(N)
for e in (eyeL,eyeR):
    bx=e[0]+np.sign(e[0])*0.02; by=e[1]+0.23
    dx=(X-bx)/0.27; dy=(Y-(by-0.07*dx**2+0.03*dx*np.sign(e[0])))/0.04
    brow=np.maximum(brow,headw*sm(1-(dx**2+dy**2),0.9)*(Z>e[2]-0.25))
cutY=ankY+0.22
sock=leg*sm(cutY+0.45-Y,0.3)*(Y>cutY-0.3)
def rawgrp(pred):
    out=np.zeros(N)
    for bn,lst in W.items():
        if pred(bn):
            for vi,w in lst:
                if vi in remap: out[remap[vi]]+=w
    return out
lips=np.clip((rawgrp(lambda n:n.startswith('oris'))-0.45)*1.6,0,0.75)
cheek=np.clip(rawgrp(lambda n:n.startswith(('risorius','levator')))*0.4,0,0.3)
def near(pt,r): return np.clip(1-np.linalg.norm(P-pt,axis=1)/r,0,1)
tint=np.maximum(lips,cheek)
for sd in 'LR':
    kn=K['shin.'+sd][1]+[0,0,0.45]; tint=np.maximum(tint,0.35*near(kn,0.9))
    elb=K['forearm.'+sd][1]; tint=np.maximum(tint,0.3*near(elb,0.6))
    for f in range(1,6):
        for k in range(1,4):
            n='finger%d-%d.%s'%(f,k,sd); tint=np.maximum(tint,0.35*near(K[n][1],0.12))
tint*= (1-headw*0)  # keep
MW=np.zeros((N,8)); MW[:,0]=tint; MW[:,1]=shirt; MW[:,2]=shorts; MW[:,5]=hair; MW[:,6]=brow; MW[:,7]=sock
# ---------- adjacency + smoothing under cloth ----------
nb=[set() for _ in range(N)]
for a,b,c in tris:
    nb[a]|={b,c}; nb[b]|={a,c}; nb[c]|={a,b}
nb=[np.array(list(s)) for s in nb]
def vnormals(P,tris):
    n=np.zeros_like(P); f=np.cross(P[tris[:,1]]-P[tris[:,0]],P[tris[:,2]]-P[tris[:,0]])
    for k in range(3): np.add.at(n,tris[:,k],f)
    return n/np.maximum(1e-9,np.linalg.norm(n,axis=1))[:,None]
cloth=np.clip(shirt+shorts,0,1)
for _ in range(5):
    Q=P.copy()
    for i in range(N):
        k=0.32*cloth[i]
        if k>0.01: Q[i]=P[i]*(1-k)+P[nb[i]].mean(0)*k
    P=Q
Nn=vnormals(P,tris)
hairRamp=headw*np.clip((el-thr+2)/14,0,1)
off=0.05*cloth+0.09*hairRamp**0.8*(1+0.8*np.clip((el-thr)/35,0,1))
P=P+Nn*off[:,None]
# ---------- remove the bare feet, build sneakers ----------
footV=(leg>0.5)&(P[:,1]<cutY)
keepT=~footV[tris].all(1)
tris=tris[keepT]
def icosphere(n):
    t=(1+5**0.5)/2
    v=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]]
    f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]]
    v=[np.array(x,float)/np.linalg.norm(x) for x in v]
    for _ in range(n):
        cache={}; nf=[]
        def mid(a,b):
            k=(min(a,b),max(a,b))
            if k not in cache: m=v[a]+v[b]; v.append(m/np.linalg.norm(m)); cache[k]=len(v)-1
            return cache[k]
        for a,b,c in f:
            ab,bc,ca=mid(a,b),mid(b,c),mid(c,a); nf+=[[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]]
        f=nf
    return np.array(v),np.array(f)
SV,SF=icosphere(4)
extraP=[];extraT=[];extraW=[];extraM=[]
base=N
for sd,mask in (('L',X>=0),('R',X<0)):
    pts=P[footV&mask]
    pts=np.vstack([pts, pts[pts[:,1]<floorY+0.25]*[1,0,1]+[0,floorY-0.12,0]])  # a sole a little under the foot
    hull=ConvexHull(pts); eq=hull.equations
    c=pts.mean(0); ext=(pts.max(0)-pts.min(0))/2
    dirs=SV*ext; dirs/=np.linalg.norm(dirs,axis=1,keepdims=True)
    nd=dirs@eq[:,:3].T; nc=eq[:,:3]@c+eq[:,3]
    with np.errstate(divide='ignore',invalid='ignore'):
        tt=np.where(nd>1e-9,-nc[None,:]/nd,np.inf)
    sp=c+dirs*tt.min(1)[:,None]
    # smooth a little, keep the sole flat
    snb=[set() for _ in range(len(sp))]
    for a,b,cc in SF: snb[a]|={b,cc}; snb[b]|={a,cc}; snb[cc]|={a,b}
    snb=[np.array(list(s)) for s in snb]
    for _ in range(4):
        sp=np.array([0.5*sp[i]+0.5*sp[snb[i]].mean(0) for i in range(len(sp))])
    sn=vnormals(sp,SF)
    sp=sp+sn*0.07
    sp[:,1]=np.maximum(sp[:,1],floorY-0.12)
    tree=cKDTree(P[footV&mask]); idxs=np.where(footV&mask)[0]
    dd,nn=tree.query(sp,k=4)
    w=1/(dd+0.05); w/=w.sum(1,keepdims=True)
    WS=(WB[idxs[nn]]*w[:,:,None]).sum(1)
    m=np.zeros((len(sp),8)); m[:,0]=0; s_=sm(floorY+0.2-sp[:,1],0.03); m[:,4]=s_; m[:,3]=1-s_
    extraP.append(sp); extraT.append(SF+base); extraW.append(WS); extraM.append(m); base+=len(sp)
P=np.vstack([P]+extraP); tris=np.vstack([tris]+extraT); WB=np.vstack([WB]+extraW); MW=np.vstack([MW]+extraM)
floorY=floorY-0.12
# drop unused vertices (bare feet)
usedV=np.zeros(len(P),bool); usedV[tris.ravel()]=True
newi=-np.ones(len(P),int); newi[usedV]=np.arange(usedV.sum())
P=P[usedV]; WB=WB[usedV]; MW=MW[usedV]; tris=newi[tris]; N=len(P)
SI=np.zeros((N,4),np.uint8); SW=np.zeros((N,4))
for i in range(N):
    o=np.argsort(-WB[i])[:4]; w=WB[i,o]; w=w/w.sum(); SI[i]=o; SW[i]=w
from scipy import ndimage
vs=0.07
lo0=P.min(0)-1.0; dims=np.ceil((P.max(0)+1.0-lo0)/vs).astype(int)
occ=np.zeros(dims,bool)
A_,B_,C_=P[tris[:,0]],P[tris[:,1]],P[tris[:,2]]
for u in np.linspace(0,1,9):
    for v in np.linspace(0,1,9):
        if u+v>1: continue
        pt=A_*(1-u-v)+B_*u+C_*v; ii=((pt-lo0)/vs).astype(int); occ[ii[:,0],ii[:,1],ii[:,2]]=True
occ=ndimage.binary_fill_holes(ndimage.binary_closing(occ,iterations=1))
Nv=vnormals(P,tris)
rng=np.random.default_rng(1); D=rng.normal(size=(48,3)); D/=np.linalg.norm(D,axis=1,keepdims=True)
AO=np.zeros(N); WT=np.zeros(N)
steps=np.geomspace(0.16,2.6,16)
for d in D:
    cosw=Nv@d; ok=cosw>0.05
    hit=np.zeros(N)
    for t in steps:
        q_=P+Nv*0.06+d[None,:]*t; ii=((q_-lo0)/vs).astype(int)
        inb=(ii>=0).all(1)&(ii<dims).all(1)
        h=np.zeros(N,bool); h[inb]=occ[ii[inb,0],ii[inb,1],ii[inb,2]]
        hit=np.maximum(hit,h*(1-(t/2.6)**0.5*0.6))
    # the floor occludes too
    tf=(floorY-P[:,1])/d[1] if d[1]<0 else np.full(N,np.inf)
    hit=np.maximum(hit,np.where(tf<2.6,0.8,0))
    AO+=ok*cosw*hit; WT+=ok*cosw
AO=1-AO/np.maximum(WT,1e-6)
# smooth the AO a little over the mesh
nbA=[set() for _ in range(N)]
for a,b,c in tris: nbA[a]|={b,c}; nbA[b]|={a,c}; nbA[c]|={a,b}
nbA=[np.array(list(x)) for x in nbA]
for _ in range(2): AO=np.array([0.5*AO[i]+0.5*AO[nbA[i]].mean() for i in range(N)])
print('AO range',AO.min(),AO.mean())
P=(P-np.array([0,floorY,0]))*0.1
lo=P.min(0); hi=P.max(0); q=np.round((P-lo)/(hi-lo)*65535).astype(np.uint16)
bones=[{'n':n,'p':(idx[K[n][0]] if K[n][0] else -1),'h':list(np.round((K[n][1]-[0,floorY,0])*0.1,5)),'t':list(np.round((K[n][2]-[0,floorY,0])*0.1,5))} for n in names]
eyes=[list(np.round((e-[0,floorY,0])*0.1,5)) for e in (eyeL,eyeR)]
hdr=json.dumps({'n':N,'tri':len(tris),'lo':list(lo),'hi':list(hi),'bones':bones,'eyes':eyes,'ao':1}).encode()
SWq=np.round(SW*255).astype(np.int32); SWq[:,0]+=255-SWq.sum(1); SWq=SWq.astype(np.uint8)
MWq=np.round(np.clip(MW,0,1)*255).astype(np.uint8)
body=q.tobytes()+tris.astype(np.uint16).tobytes()+SI.tobytes()+SWq.tobytes()+MWq.tobytes()+np.round(np.clip(AO,0,1)*255).astype(np.uint8).tobytes()
blob=struct.pack('<I',len(hdr))+hdr+body
z=gzip.compress(blob,9)
open(outp,'w').write('var HUMAN_DATA="'+base64.b64encode(z).decode()+'";\n')
print('brow verts',(MW[:,6]>0.5).sum(),'hair',(MW[:,5]>0.5).sum())
print('verts',N,'tris',len(tris),'raw',len(blob),'gz',len(z),'height m',P[:,1].max())
