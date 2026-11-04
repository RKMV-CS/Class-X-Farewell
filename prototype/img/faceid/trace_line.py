"""Vectorise swamiji_line_src.png (one-line portrait, black on white) into ONE continuous SVG path for the Face ID sheet.
skeleton -> chain graph -> eulerised walk (shared geometry is reused forward/backward, so retraced bits overlap exactly) -> Catmull-Rom -> cubic beziers.
usage: python trace_line.py [src.png [out.json [preview.png]]]   writes swamiji_path.json {d, w, h, bbox}"""
import sys, json, math, itertools
import cv2, numpy as np, networkx as nx
from skimage.morphology import skeletonize

here = __file__.rsplit('trace_line.py', 1)[0]
SRC = sys.argv[1] if len(sys.argv) > 1 else here + 'swamiji_line_src.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else here + 'swamiji_path.json'
g = cv2.imread(SRC, 0)
bw = (g < 140)
bw = cv2.morphologyEx(bw.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
sk = skeletonize(bw)
H, W = sk.shape
ys, xs = np.nonzero(sk)
P = set(zip(xs.tolist(), ys.tolist()))
N8 = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
nb = lambda p: [(p[0] + dx, p[1] + dy) for dx, dy in N8 if (p[0] + dx, p[1] + dy) in P]

def prune(P, spur=9, rounds=2):
    for _ in range(rounds):
        ends = [p for p in P if len(nb(p)) == 1]
        for e in ends:
            path = [e]; cur = e; prev = None
            while True:
                nxt = [q for q in nb(cur) if q != prev and q not in path]
                if len(nxt) != 1: break
                prev, cur = cur, nxt[0]; path.append(cur)
                if len(path) > spur: break
            if len(path) <= spur and len(nb(path[-1])) >= 3:
                for q in path[:-1]: P.discard(q)
    return P
P = prune(P)
deg = {p: len(nb(p)) for p in P}
node_px = {p for p in P if deg[p] != 2}
# cluster adjacent node pixels into one node
cl = {}; nodes = []
for p in node_px:
    if p in cl: continue
    stack = [p]; cl[p] = len(nodes); members = [p]
    while stack:
        c = stack.pop()
        for q in nb(c):
            if q in node_px and q not in cl: cl[q] = len(nodes); stack.append(q); members.append(q)
    nodes.append(np.mean(members, 0))
# trace chains between nodes
used = set(); chains = []   # (nodeA, nodeB, [pixels])
for p in node_px:
    for q in nb(p):
        if q in node_px or (p, q) in used: continue
        path = [p, q]; used.add((p, q)); prev, cur = p, q
        while cur not in node_px:
            nxt = [r for r in nb(cur) if r != prev]
            if not nxt: break
            prev, cur = cur, nxt[0]; path.append(cur)
        if cur in node_px:
            used.add((cur, path[-2])); chains.append((cl[p], cl[cur], path))
# node-to-node direct adjacency is already merged by clustering
print('skeleton px', len(P), 'nodes', len(nodes), 'chains', len(chains), file=sys.stderr)

def smooth_chain(path, a, b):
    pts = np.array(path, float)
    pts[0] = nodes[a]; pts[-1] = nodes[b]
    if len(pts) > 5:   # light moving average to kill pixel stair-steps, ends pinned
        k = np.ones(5) / 5; ext = np.r_[[pts[0]] * 2, pts, [pts[-1]] * 2]
        pts[1:-1] = np.c_[np.convolve(ext[:, 0], k, 'valid'), np.convolve(ext[:, 1], k, 'valid')][1:-1]
    simp = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), 1.2, False).reshape(-1, 2)
    return simp

C = {i: smooth_chain(pa, a, b) for i, (a, b, pa) in enumerate(chains)}
G0 = nx.MultiGraph()
for i, (a, b, pa) in enumerate(chains):
    G0.add_edge(a, b, key=i, w=len(pa))
# every stroke of the drawing, not just the biggest: tiny blobs (lettering, specks) are dropped, the rest become pen-lift subpaths
MIN_PX = 50
comps = [c for c in nx.connected_components(G0) if sum(d['w'] for _, _, d in G0.subgraph(c).edges(data=True)) >= MIN_PX]
comps.sort(key=lambda c: -sum(d['w'] for _, _, d in G0.subgraph(c).edges(data=True)))

def walk_points(comp):
    G = G0.subgraph(comp).copy()
    odd = [n for n in G if G.degree(n) % 2]
    ends = [n for n in odd if G.degree(n) == 1]
    start = end = None
    if len(ends) >= 2:
        start, end = max(itertools.combinations(ends, 2), key=lambda ab: np.hypot(*(nodes[ab[0]] - nodes[ab[1]])))
    match = [n for n in odd if n not in (start, end)]
    SG = nx.Graph()
    for u, v, k, d in G.edges(keys=True, data=True):
        if not SG.has_edge(u, v) or SG[u][v]['w'] > d['w']: SG.add_edge(u, v, w=d['w'], key=k)
    if match:
        D = dict(nx.all_pairs_dijkstra(SG, weight='w'))
        K = nx.Graph()
        for a, b in itertools.combinations(match, 2): K.add_edge(a, b, weight=-D[a][0][b] if b in D[a][0] else -1e9)
        M = nx.max_weight_matching(K, maxcardinality=True)
        dup = 0
        for a, b in M:
            path = D[a][1][b]
            for u, v in zip(path, path[1:]):
                G.add_edge(u, v, key=('d', dup), w=SG[u][v]['w'], ref=SG[u][v]['key']); dup += 1
    if start is None:
        start = next(iter(G.nodes))
    walk = list(nx.eulerian_path(G, source=start, keys=True)) if start is not None and end is not None else list(nx.eulerian_circuit(G, source=start, keys=True))
    pts = []
    for u, v, k in walk:
        ref = G[u][v][k].get('ref', k)
        a, b, _ = chains[ref]
        poly = C[ref]
        d0 = np.hypot(*(poly[0] - nodes[u])); d1 = np.hypot(*(poly[-1] - nodes[u]))
        seg = poly if d0 <= d1 else poly[::-1]
        pts += [tuple(p) for p in (seg if not pts else seg[1:])]
    return pts
PTS = [p for p in (walk_points(c) for c in comps) if len(p) > 1]
pts = [q for p in PTS for q in p]
print('components', len(PTS), 'pts', len(pts), file=sys.stderr)

def catmull(pts):
    Q = [np.array(p, float) for p in pts]; Q = [Q[0]] + Q + [Q[-1]]; segs = []
    for i in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
        d1 = max(np.linalg.norm(p1 - p0), 1e-6) ** .5; d2 = max(np.linalg.norm(p2 - p1), 1e-6) ** .5; d3 = max(np.linalg.norm(p3 - p2), 1e-6) ** .5
        t1 = (p2 - p0) / 6 * min(1, 2 * d2 / (d1 + d2)); t2 = (p3 - p1) / 6 * min(1, 2 * d2 / (d2 + d3))
        segs.append((p1, p1 + t1, p2 - t2, p2))
    return segs
SEGS = [catmull(p) for p in PTS]
segs = [sg for ss in SEGS for sg in ss]
allp = np.array(pts)
x0, y0 = allp.min(0); x1, y1 = allp.max(0)
ox, oy = math.floor(x0) - 4, math.floor(y0) - 4
f = lambda p: f"{round(p[0] - ox, 1):g} {round(p[1] - oy, 1):g}"
d = "".join("M" + f(ss[0][0]) + "".join("C" + f(a[1]) + " " + f(a[2]) + " " + f(a[3]) for a in ss) for ss in SEGS)
out = {'d': d, 'w': int(x1 - x0 + 8), 'h': int(y1 - y0 + 8), 'ox': ox, 'oy': oy, 'pts': len(pts)}
json.dump(out, open(OUT, 'w'))
print(len(d), 'chars', out['w'], out['h'], file=sys.stderr)
if len(sys.argv) > 3:
    img = np.zeros((H, W, 3), np.uint8); q = []
    for ss in SEGS:
        q = []
        for (p0, c1, c2, p3) in ss:
            for t in np.linspace(0, 1, 12): q.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t ** 2 * c2 + t ** 3 * p3)
        cv2.polylines(img, [np.array(q, np.int32).reshape(-1, 1, 2)], False, (255, 255, 255), 3, cv2.LINE_AA)
    src = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
    cv2.imwrite(sys.argv[3], np.hstack([src, img]))
