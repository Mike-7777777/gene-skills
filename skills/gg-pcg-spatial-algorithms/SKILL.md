---
name: gg-pcg-spatial-algorithms
description: Generate interactive 3D HTML/WebGL (Three.js) spatial blockout and underground cavern levels using GenerativeGame's scientific PCG pipeline (seeded fractal noise + Domain Warp, Max-Min room dispersion, Kruskal MST + randomized Manhattan corridors, protected cellular automata, Poisson disk prop sampling, and 3D BFS + cavity-split reachability verification).
---

# GG PCG Spatial Algorithms (3D Terrain & Connected Cavern Web Blockout)

Distilled from `BiomeMapGeneratorCore` (`GenerateCaveBitsCore`, `GenerateBoundaryCore`, Poisson sampling), `FCalamityRiftLayoutGenerator` (Max-Min Manhattan room scattering & boss-avoiding shortest paths), and `UClosedSpaceDetector` (outside-reachability Flood-Fill & cavity splitting).

Use this skill to build **self-contained 3D HTML/WebGL (Three.js) spatial planning tools and playable 3D region/underground blockouts** where terrain elevation, multi-room cavern division, vertical/horizontal tunnels, and guaranteed start-to-exit traversability are mathematically verified.

## When to use

- "帮我写一个能在网页里看的微缩 3D 地形，地面有高低起伏，地下分成几个地洞房间，房间之间要有通道和斜坡连起来，保证从起点能一路走通到终点，不要有死路。"
- Any request to build a browser-based 3D terrain blockout, underground cavern / dungeon layout, or multi-elevation spatial structure with guaranteed start-to-exit reachability.

## Three-Round Hidden Verification Gate (Headless PCG Core First)

Before binding to Three.js meshes or delivering the interactive `.html`, isolate the pure-data 3D grid/heightfield generator and run three hidden verification gates:
- **R1 (Seeded Room Dispersion & Boundary Gate)**: Derive all RNG streams deterministically from `GenerationSeed`; scatter room AABBs via Max-Min Manhattan distance without boundary or pairwise overlap.
- **R2 (MST + Loop Backbone & Protected CA Gate)**: Connect all chambers via Kruskal MST + 15%–25% loop edges with explicit ramps/shafts ($\text{slope} \le 1:2$, width $\ge 3$), lock them in `ProtectedMask`, and run 3D Cellular Automata only on unprotected wall cells.
- **R3 (Cavity Cleanup & 3D BFS Traversability Gate)**: Flood-fill walkable cells from Entry to Exit; fill or reconnect any isolated cavities (`UClosedSpaceDetector`) so `ConnectedWalkableComponents === 1` and `bfsPath(Start, Exit).found === true`.

## 1. Deterministic Seed & Multi-Layer 3D Grid Model

1. **Single Seed Contract (`GenerationSeed`)**:
   - Never call unseeded `Math.random()`. Derive all sub-stage RNGs from a deterministic 32-bit PRNG (`mulberry32` or `xoshiro128**`) seeded with `hashCombine(GenerationSeed, stageConstant)`.
2. **Dual-Layer / 3D Voxel-Height Representation**:
   - **Surface Layer ($z \ge 0$)**: Continuous heightfield $H(x, y)$ generated via Domain-Warped Fractal Perlin/Simplex Noise (`octaves = 3..4`, `lacunarity = 2.0`, `gain = 0.5`) with smoothstep power shaping around valley/basin boundaries.
   - **Underground / Cavern Layer ($z < 0$ or Multi-Floor 3D Grid)**: 3D occupancy tensor $V[x, y, z] \in \{\text{Wall}, \text{Floor}, \text{Corridor}, \text{Shaft/Ramp}, \text{Chasm/Hazard}\}$ plus a `ProtectedMask[x, y, z]` bitset.

## 2. Five-Stage Cavern & Spatial Structure Pipeline

Always execute spatial generation in this exact order so later noise/erosion never severs critical paths:

### Stage A: Skeleton Room Scattering (Max-Min Dispersion)
- Place **Entry Portal** and **Exit / Boss Chamber** on opposite boundary bands.
- Scatter $K$ intermediate functional chambers (e.g., Hub, Treasure, Vertical Shaft Room, Rest Node) using **Max-Min Manhattan/Euclidean Dispersion** (`FCalamityRiftLayoutGenerator::SelectMostEvenRoomCoordinate`):
  $$
  p_{\text{next}} = \arg\max_{c \in \text{Candidates}} \min_{r \in \text{PlacedRooms}} \|c - r\|_1
  $$
- Carve each room's 3D bounding box and mark its interior + 1-cell shell in `ProtectedMask = true`.

### Stage B: Spanning-Tree Backbone & Loop Corridors (Kruskal MST + Loop Ratio)
- Build a complete distance graph over room centers; extract the **Minimum Spanning Tree (MST)** so every chamber is reachable with minimum total tunnel length.
- Re-introduce $15\%\text{–}25\%$ of non-MST short edges to create **tactical loops** (avoiding linear dead-end backtracking while keeping the Boss room on a gated leaf or final bridge).
- Carve corridors using **Randomized Shortest Manhattan/3D Stair Paths** with minimum width $\ge 3$ cells for main arteries and $\ge 2$ cells for side tunnels; when connecting different elevations $\Delta z \neq 0$, insert explicit **Ramp / Spiral Stair / Elevator Shaft** volumes with slope $\le 1:2$. Mark all corridor and ramp cells in `ProtectedMask = true`.

### Stage C: Protected Cellular Automata (Organic Cavern Erosion)
- Initialize non-protected wall cells with seeded fill probability $p_{\text{wall}} \approx 0.45\text{–}0.52$.
- Run $3\text{–}4$ iterations of 26-neighbor (3D) or 8-neighbor (2.5D slice) **Cellular Automata** (`4-5 rule`), **strictly skipping any cell where `ProtectedMask == true`**.
- This gives natural, organic rock walls and side alcoves while 100% preserving the engineered room-and-corridor skeleton.

### Stage D: Poisson Disk Prop & Pillar Placement
- Sample structural pillars, ore clusters, light braziers, and cover rocks inside walkable floor regions using **2D/3D Bridson Poisson Disk Sampling** (`GlobalMinDistance`, `maxAttempts = 30`).
- Reject any sample that lands on the central 2-cell spine of a corridor or within a $3 \times 3$ doorway apron.

### Stage E: Closed-Space Cavity Audit & 3D BFS Traversability Proof
- **Outside-Reachability & Pocket Cleanup (`UClosedSpaceDetector`)**:
  - Run 6-way/4-way Flood-Fill from the Entry Portal across all walkable cells (accounting for step height $\Delta h \le 1$ and ramps).
  - Any disconnected empty cavity discovered by component labeling must either be **filled back into solid rock** or **connected to the nearest main corridor**, guaranteeing **Connected Walkable Components $= 1$**.
- Compute and display quantitative spatial metrics in the HTML HUD:
  - `Main Path Length (steps)`, `Total Walkable Volume (%)`, `Room Count`, `Loop Count`, `Connected Component Count (must be 1)`, and `Bottleneck Min Width`.

## 3. Interactive 3D HTML Visualization Spec

When generating the single-file `.html` spatial planner:
- **View Modes**: Provide instant toggles between **3D Perspective Orbit View**, **Top-Down X-Ray Cutaway (Slice by $Z$)**, **Topological Graph Overlay** (room nodes + MST/loop edges + BFS heatmap), and **First-Person / Third-Person Walkthrough**.
- **Color Semantics**: Distinct procedural materials for Surface Terrain, Cavern Ceiling/Walls (cutaway /半透明剖面), Main Protected Artery, Secondary Loop Corridors, Ramps/Vertical Shafts, and Poisson Props.
- **Interactive Controls**: Seed input, Regenerate button, Room Count / Cave Openness / Loop Ratio sliders, and a live **Spatial Rationality Inspector** panel showing PASS/FAIL on reachability and choke-point clearance.
