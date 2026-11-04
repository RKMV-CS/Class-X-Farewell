"""Hand-keyed single-stroke line art of Swami Vivekananda, traced from prototype/img/covers/swamiji.jpg (public-domain 1893 Chicago portrait).
Strokes are keyed in photo pixels (1024 grid); stitched into ONE continuous path (short connectors between strokes, like continuous-line art),
Catmull-Rom smoothed -> cubic beziers. Output: swamiji_path.json {d, w, h}; preview PNG.  usage: python build_swamiji.py [preview.png]"""
import json, sys, math
import numpy as np

def circ(cx, cy, r, a0=90, turns=1.0, n=14):
    return [(cx + r*math.cos(math.radians(a0 + 360*turns*i/n)), cy + r*math.sin(math.radians(a0 + 360*turns*i/n))) for i in range(n+1)]

S = []  # strokes in drawing order
# A coat shoulder -> neck -> jaw underside -> collar V -> right jaw -> ear -> turban bottom
S.append([(70,1022),(140,985),(203,943),(250,912),(268,880),(300,905),(345,930),(403,952),(450,968),(503,976),(552,958),(596,926),(614,886),(632,836),(643,790),(649,750),(655,722),(690,714),(716,724)])
# B turban outline: right edge up, tufted top, left edge down
S.append([(716,724),(731,700),(743,650),(753,590),(762,530),(760,478),(744,420),(718,352),(695,292),(686,264),(662,246),(628,236),(604,198),(572,182),(540,198),(505,208),(470,200),(446,172),(428,178),(398,212),(348,230),(302,254),(262,290),(250,322),(238,382),(224,440),(213,490),(214,530)])
# C turban folds: left rows low (L->R), mid (R->L), high (L->R); right rows high (->R), mid (->L), low (->R); then the inner fold edge and the hairline to the left temple
S.append([(214,530),(244,452),(310,388),(390,342),(470,326)])
S.append([(462,300),(390,314),(318,352),(262,404),(226,468),(220,490)])
S.append([(230,400),(270,345),(335,305),(410,285),(485,282)])
S.append([(485,282),(570,293),(655,338),(718,403),(750,468)])
S.append([(752,500),(716,452),(650,400),(570,356),(490,336)])
S.append([(490,368),(570,386),(650,430),(710,490),(742,560)])
S.append([(742,560),(738,620)])
S.append([(738,620),(712,585),(676,540),(636,495),(596,458),(566,445)])
S.append([(588,478),(626,530),(662,590),(694,650),(712,700),(716,724)])
S.append([(716,724),(684,712),(652,690),(622,640),(596,590),(566,540),(536,490),(506,448),(478,420),(440,408),(395,414),(345,436),(300,466),(266,510),(246,552),(240,580)])
# D left face edge down to the neck and straight back (retrace = one line)
_le=[(240,580),(237,612),(243,690),(247,743),(252,800),(260,850),(268,880)]
S.append(_le+_le[::-1][1:])
# E left brow, left eye (upper lid, lower lid, iris), nose down the left side and base
S.append([(262,590),(285,572),(325,560),(365,566),(395,590),(398,602),(392,622)])
S.append([(392,622),(375,610),(345,602),(318,603),(298,618),(312,636),(345,646),(378,638),(392,622)])
S.append(circ(343,627,16,a0=-90,turns=1.0,n=14))
S.append([(388,636),(384,665),(374,700),(356,726),(350,738),(366,750),(392,751),(418,746)])
# F philtrum, mouth (upper lip right, lower lip, lip line) and back up to the nose base, then the wing
S.append([(418,746),(422,758),(426,768),(448,771),(474,781),(497,797),(470,816),(432,825),(392,820),(362,806),(350,788),(400,794),(450,796),(497,797),(474,781),(448,771),(426,768),(422,758),(418,746)])
S.append([(418,746),(440,736),(452,722),(446,706)])
# G right nose side up, right eye (upper, lower, iris), right brow
S.append([(446,706),(430,690),(424,672),(434,650),(452,628)])
S.append([(452,628),(472,612),(505,603),(535,610),(556,628),(535,642),(500,648),(468,642),(452,628)])
S.append(circ(510,628,16,a0=-90,turns=1.0,n=14))
S.append([(560,620),(568,592),(540,572),(500,568),(462,578),(440,594)])

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
