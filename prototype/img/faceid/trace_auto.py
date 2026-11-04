"""Candidate A: automatic trace of swamiji.jpg -> edge map -> skeleton -> one stitched polyline (nearest-neighbour), RDP + Catmull-Rom. Writes candA.png (white on black)."""
import cv2, numpy as np, sys
from skimage.morphology import skeletonize, remove_small_objects
im = cv2.imread('../covers/swamiji.jpg', 0)
g = cv2.createCLAHE(2.5, (8, 8)).apply(cv2.GaussianBlur(im, (0, 0), 2.2))
e = cv2.Canny(g, 18, 46)
mask = np.zeros_like(e); cv2.fillPoly(mask, [np.array([(190,150),(780,150),(790,760),(660,1000),(200,1000),(60,1024),(60,900),(190,700)])], 255)
e = cv2.bitwise_and(e, mask)
e = cv2.dilate(e, np.ones((3, 3), np.uint8))
sk = skeletonize(remove_small_objects(e > 0, 120))
n, lab, st, _ = cv2.connectedComponentsWithStats(sk.astype(np.uint8), connectivity=8)
comps = []
for i in range(1, n):
    ys, xs = np.nonzero(lab == i)
    if len(xs) < 40: continue
    pts = np.c_[xs, ys].astype(float)
    # order the pixels of the component greedily from one extreme
    start = pts[np.argmin(pts[:, 0] + pts[:, 1])]; order = [start]; rest = list(map(tuple, pts)); rest.remove(tuple(start))
    P = np.array(rest)
    cur = start
    while len(P):
        d = np.hypot(*(P - cur).T); j = int(np.argmin(d))
        if d[j] > 6: break
        cur = P[j]; order.append(cur); P = np.delete(P, j, 0)
    if len(order) > 40: comps.append(cv2.approxPolyDP(np.array(order, np.float32).reshape(-1, 1, 2), 2.5, False).reshape(-1, 2))
# stitch strokes by nearest endpoint
comps.sort(key=lambda c: -len(c)); path = list(comps.pop(0))
while comps:
    end = path[-1]; best = None
    for k, c in enumerate(comps):
        for rev in (0, 1):
            a = c[-1] if rev else c[0]; d = np.hypot(*(a - end))
            if best is None or d < best[0]: best = (d, k, rev)
    _, k, rev = best; c = comps.pop(k); path += list(c[::-1] if rev else c)
out = np.zeros((1024, 1024, 3), np.uint8)
cv2.polylines(out, [np.array(path, np.int32).reshape(-1, 1, 2)], False, (255, 255, 255), 2, cv2.LINE_AA)
cv2.imwrite(sys.argv[1], out); print(len(path))
