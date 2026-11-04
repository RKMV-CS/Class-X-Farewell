"""Hand-keyed single-stroke line art of Swami Vivekananda, traced from prototype/img/covers/swamiji.jpg (public-domain 1893 Chicago portrait).
Strokes are keyed in photo pixels (1024 grid); stitched into ONE continuous path (short connectors between strokes, like continuous-line art),
Catmull-Rom smoothed -> cubic beziers. Output: swamiji_path.json {d, w, h}; preview PNG.  usage: python build_swamiji.py [preview.png]"""
import json, sys, math
import numpy as np

def circ(cx, cy, r, a0=90, turns=1.0, n=14):
    return [(cx + r*math.cos(math.radians(a0 + 360*turns*i/n)), cy + r*math.sin(math.radians(a0 + 360*turns*i/n))) for i in range(n+1)]

S = []  # strokes in drawing order
# A robe-left -> jaw underside -> collar -> right jaw -> ear -> turban bottom
S.append([(80,1018),(150,972),(215,936),(265,893),(325,914),(395,942),(430,962),(440,985),(470,1000),(530,1006),(590,990),(606,962),(608,918),(622,868),(638,806),(646,748),(652,714),(686,716),(716,724)])
# B turban outline: right edge up, soft top, left edge down
S.append([(716,724),(730,700),(742,650),(752,590),(762,530),(760,480),(742,420),(716,350),(692,290),(684,262),(660,246),(618,232),(596,204),(560,192),(520,206),(480,204),(448,178),(430,180),(395,212),(345,228),(300,254),(258,292),(248,320),(236,380),(222,440),(212,490),(214,530)])
# C turban folds (serpentine) then the inner fold edge down-right, hairline to the left temple
S.append([(214,530),(244,452),(310,388),(390,342),(470,326)])                       # left folds: low (L->R), mid (R->L), high (L->R)
S.append([(462,300),(390,314),(318,352),(262,404),(226,468),(220,490)])
S.append([(230,400),(270,345),(335,305),(410,285),(485,282)])
S.append([(485,282),(570,293),(655,338),(718,403),(750,468)])                       # right folds: high (->R), mid (->L), low (->R)
S.append([(752,500),(716,452),(650,400),(570,356),(490,336)])
S.append([(490,368),(570,386),(650,430),(710,490),(742,560)])
S.append([(742,560),(742,650),(716,724)])
S.append([(716,724),(684,712),(652,690),(622,640),(596,590),(566,540),(536,490),(506,448),(478,420),(440,408),(395,414),(345,436),(300,466),(266,510),(246,552),(240,580)])
# D0 left face edge down to the neck and straight back (retrace = one line)
_le=[(240,580),(236,612),(243,690),(246,740),(252,800),(258,850),(265,893)]
S.append(_le+_le[::-1][1:])
# D left brow, left eye, nose down the left side, base, mouth excursion, nose right side up, right eye, right brow
S.append([(262,590),(300,568),(345,564),(385,578),(398,598),(392,622)])
S.append([(392,622),(362,606),(326,604),(296,620),(320,640),(352,648),(388,630)])
S.append(circ(343,627,13,a0=-90,turns=1.0,n=12))
S.append([(388,636),(384,665),(373,700),(354,732),(350,740),(372,750),(406,744),(436,730),(444,718)])
S.append([(444,718),(436,744),(446,786),(404,772),(380,780),(345,792),(368,814),(420,822),(470,812),(494,800),(446,786),(436,744),(444,718)])
S.append([(444,718),(430,704),(420,680),(434,650),(452,628)])
S.append([(452,628),(480,606),(520,606),(558,626),(536,643),(500,646),(468,640),(452,628)])
S.append(circ(505,626,13,a0=-90,turns=1.0,n=12))
S.append([(560,620),(566,598),(532,577),(486,572),(446,588),(440,596)])

def stitch(strokes):
    pts = []
    for s in strokes:
        pts += s if not pts or pts[-1] != s[0] else s[1:]
    return pts

def catmull(pts, alpha=0.5, closed=False):
    P = [np.array(p, float) for p in pts]
    P = [P[0]] + P + [P[-1]]
    segs = []
    for i in range(1, len(P)-2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        d1 = max(np.linalg.norm(p1-p0), 1e-6)**alpha; d2 = max(np.linalg.norm(p2-p1), 1e-6)**alpha; d3 = max(np.linalg.norm(p3-p2), 1e-6)**alpha
        b1 = p1 + (d1**2*(p2-p1) - d2**2*(p0-p1)*0 ) * 0  # placeholder replaced below
        # uniform-ish tension (tangent form)
        t1 = (p2 - p0) / 6.0 * min(1, 2*d2/(d1+d2)); t2 = (p3 - p1) / 6.0 * min(1, 2*d2/(d2+d3))
        segs.append((p1, p1 + t1, p2 - t2, p2))
    return segs

def build(strokes, ox, oy, s=1.0):
    pts = stitch(strokes)
    segs = catmull(pts)
    f = lambda p: f"{(p[0]-ox)*s:.1f} {(p[1]-oy)*s:.1f}".replace('.0 ', ' ').rstrip('0').rstrip('.') if False else f"{round((p[0]-ox)*s,1):g} {round((p[1]-oy)*s,1):g}"
    d = "M" + f(segs[0][0]) + "".join("C" + f(a[1]) + " " + f(a[2]) + " " + f(a[3]) for a in segs)
    return d, pts, segs

if __name__ == '__main__':
    ox, oy, w, h = 60, 120, 740, 920
    d, pts, segs = build(S, ox, oy)
    json.dump({'d': d, 'w': w, 'h': h, 'pts': len(pts)}, open(__file__.replace('build_swamiji.py', 'swamiji_path.json'), 'w'))
    print(len(d), 'chars', len(pts), 'ctrl pts')
    if len(sys.argv) > 1:
        import cv2
        im = cv2.imread(__file__.replace('build_swamiji.py', '../covers/swamiji.jpg'))
        sc = 1.0
        a = (im * 0.55).astype(np.uint8); b = np.zeros_like(im)
        def draw(img, col, th):
            q = []
            for (p0, c1, c2, p3) in segs:
                for t in np.linspace(0, 1, 16):
                    q.append((1-t)**3*p0 + 3*(1-t)**2*t*c1 + 3*(1-t)*t**2*c2 + t**3*p3)
            cv2.polylines(img, [np.array(q, np.int32).reshape(-1, 1, 2)], False, col, th, cv2.LINE_AA)
        draw(a, (80, 255, 130), 3); draw(b, (255, 255, 255), 3)
        cv2.imwrite(sys.argv[1], np.hstack([a, b]))
