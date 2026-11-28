---
name: gg-combat-htn-geometry
description: Design and build idle/tycoon vending-machine queue and click-for-gold mini-games with strictly orderly visitor queuing, slot-indexed spatial reservations, HTN-inspired multi-tier utility state machines, and 2.5D isometric steering geometry.
---

# GG Combat HTN Geometry (Orderly Queue & Idle Vending Tycoon Engine)

Distilled from `UHTNCostCalculator` (order-of-magnitude domain priority), `UNPCWorkTargetReservationSubsystem` / `NPCWorkStandCoordReservationHelper` (exclusive spatial slot reservation), `UHTNCalculationLibrary` (2D disk separation & boundary projection), and `UMathAlgorithmLibrary` (2.5D orthographic/isometric projection).

Use this skill to build **idle / placement tycoon games** where visitors walk through a park/plaza, line up in **strictly orderly queues at vending machines**, pay gold (automatically and via player click-boosts), and exit smoothly without overlapping, cutting in line, or deadlocking.

## When to use

- "帮我做一个放置小游戏网页，游客进来去自动售卖机买东西要排队，买完会掉金币，我点击售卖机还能加快收钱速度；排队一定要整整齐齐一个跟一个往前走，别挤成一团或者插队。"
- Any idle tycoon, shop simulation, or crowd management mini-game requiring orderly slot-based queuing, zero agent overlapping, and click-to-accelerate coin generation.

## Three-Round Hidden Verification Gate (Headless Queue State First)

Isolate the pure-data queue reservation and economy engine from the 2.5D canvas renderer and pass three hidden verification gates:
- **R1 (Exclusive Slot Reservation Gate)**: Every queued agent holds a unique `(machineId, slotIndex)` in `ReservationTable`; no two agents ever share a slot coordinate $\mathbf{S}_k^{(m)}$.
- **R2 (Tangent Tail-Join & 1D Headway Gate)**: Approaching visitors route around occupied queue disks (`ProjectPointToCircleBoundary`) to join $\mathbf{S}_{\text{tail}}^{(m)}$, and queued agents maintain 1D arc-length separation $\|\mathbf{p}_{k-1} - \mathbf{p}_k\| \ge d_{\text{min}}$ with zero line-cutting.
- **R3 (Wavefront Promotion & Gold Ledger Gate)**: Serving $\mathbf{S}_0^{(m)}$ promotes remaining slots with staggered delay $0.08\text{s} \cdot k$, and rapid player clicks conserve gold payouts under Little's Law throughput bounds.

## 1. Orderly Queue Topology & Slot Reservation Math

Never let agentscrowd toward a single point `(machine.x, machine.y)` using naive boids or raw distance attraction—that causes chaotic clumping. Enforce a **Deterministic Slot-Indexed Queue Line**:

1. **Polyline / Spline Queue Anchor Chain**:
   - Each vending machine $m$ defines a service window anchor $\mathbf{S}_0^{(m)}$ (facing direction $\hat{\mathbf{f}}_m$) and an ordered array of $K$ queue slot world positions $\mathbf{S}_0^{(m)}, \mathbf{S}_1^{(m)}, \dots, \mathbf{S}_{K-1}^{(m)}$ spaced at fixed headway $d_{\text{slot}} = 2.2 \cdot r_{\text{agent}}$ along a guide path (straight line, L-turn, or serpentine stanchion path).
2. **Exclusive Ticket & Slot Reservation (`ReservationTable`)**:
   - Maintain a FIFO queue array `queue[m] = [agentId_0, agentId_1, ...]`.
   - Agent at index $k \in [0, \text{length}-1]$ has **exclusive reservation** of target coordinate $\mathbf{S}_k^{(m)}$. No two visitors may ever target the same slot index.
3. **Cascade Slot Advancement (Wavefront Promotion)**:
   - When `agentId_0` finishes purchasing at $\mathbf{S}_0^{(m)}$ and transitions to `Leaving`:
     - Pop index `0` from `queue[m]`.
     - Every remaining agent at new index $k$ increments its target to $\mathbf{S}_k^{(m)}$ after a staggered reaction delay $\Delta t_{\text{react}} = 0.08\text{ s} \cdot k$, creating a realistic, visually satisfying forward ripple along the line.

## 2. 1D Headway & 2D Disk Collision Avoidance Geometry

To guarantee visitors never clip through each other while approaching or advancing in line (`UHTNCalculationLibrary` disk geometry):

1. **Queue Corridor 1D Headway Clamp**:
   - Along the queue spline arc-length $s$, enforce a strict minimum following distance behind the predecessor agent $k-1$:
     $$
     s_k(t + \Delta t) \le s_{k-1}(t) - d_{\text{slot}}, \qquad v_k = v_{\max} \cdot \text{clamp}\left(\frac{\|\mathbf{p}_{k-1} - \mathbf{p}_k\| - d_{\text{min}}}{d_{\text{slot}} - d_{\text{min}}}, 0, 1\right)
     $$
2. **Entry Tail-Attachment Routing (No Line-Cutting)**:
   - New arrivals **never** walk to $\mathbf{S}_0^{(m)}$. They query the current tail slot $\mathbf{S}_{\text{tail}}^{(m)}$ (`tail = queue[m].length`).
   - If the visitor's straight segment to $\mathbf{S}_{\text{tail}}^{(m)}$ intersects any occupied queue disk $C(\mathbf{S}_j^{(m)}, r_{\text{clear}})$, project an intermediate waypoint onto the outer tangent of the queue bounding corridor (`ProjectPointToCircleBoundary` + `BoundaryNudge`) so the visitor walks **around** the line to join the back.

## 3. HTN-Inspired Order-of-Magnitude Visitor Utility & State Machine

Structure each visitor's decision logic using strict domain priority (`UHTNCostCalculator`):

| Priority Tier | Cost Band | Visitor State / Action | Transition Condition |
|---|---:|---|---|
| **Tier 1: Exit / Full** | `100..999` | `LeavingWithGoods` / `ImpatientLeave` | Inventory full OR patience timer $P \le 0$ |
| **Tier 2: Active Service** | `1,000..9,999` | `PurchasingAtWindow` ($\mathbf{S}_0$) | Reached $\mathbf{S}_0$; service progress $0 \to 100\%$ over $\tau_{\text{serve}}$ |
| **Tier 3: Queued** | `10,000..99,999` | `AdvancingInQueue` ($\mathbf{S}_k, k \ge 1$) | Assigned to machine $m$, following slot $k-1$ |
| **Tier 4: Seeking Machine** | `100,000+` | `SelectingVendingMachine` | Evaluates candidate machines by $Cost = \text{Base} + w_d \cdot \text{Dist} + w_q \cdot (\text{QueueLen} \cdot \hat{\tau}_{\text{serve}}) - \text{PreferenceBonus}$ |

- **Load Balancing via Queue Cost**: Because each queued person adds $w_q \cdot \hat{\tau}_{\text{serve}}$ to a machine's HTN cost, new visitors naturally distribute across multiple vending machines when one line gets long, or reject entry if all queues are at capacity $K$.

## 4. Click-for-Gold & Idle Economy Loop

Combine active clicking with automated queue throughput (`$game-economy-balance`):

1. **Dual Click Mechanics**:
   - **Click on Vending Machine / Cashier**: Instantly advances current customer's service progress by $+\Delta p_{\text{click}}$ (e.g., $+35\%$) and spawns a floating `+Gold` coin arc, accelerating queue turnover.
   - **Click on Dropped Coins / VIP Visitors**: Collects bonus tip gold or triggers a temporary ` Rush / Fever` multiplier.
2. **Throughput Bottleneck Equation (Little's Law)**:
   - Arrival rate $\lambda$ (visitors/sec), machine service rate $\mu = 1 / \tau_{\text{serve}}$, number of machines $M$:
     $$
     \rho = \frac{\lambda}{M \cdot \mu}, \qquad \text{Effective Gold/sec} = \min(\lambda, M \cdot \mu) \cdot \text{Price}_{\text{item}} \cdot (1 + \text{TipBonus})
     $$
   - Expose upgrade buttons targeting the three real mathematical levers: **Service Speed ($\mu \uparrow$)**, **Queue Capacity & Path Stanchions ($K \uparrow$)**, **Item Value ($\text{Price} \uparrow$)**, and **Marketing / Spawn Rate ($\lambda \uparrow$)**.

## 5. 2.5D Isometric / Orthographic Presentation Polish

- Use 2.5D orthographic stretch correction ($\sec(\theta) = 1/\cos(\theta)$) and depth sorting (`zIndex = Math.floor(y * 10 + x)`).
- Render floor queue footprint markers (chevrons / numbered tiles / velvet rope stanchions), per-customer overhead patience/progress rings, bouncy walk-cycle bobbing (`|sin(phase)|` when moving, `0` when standing still in slot), and parabolic coin fly-to-HUD animations.
