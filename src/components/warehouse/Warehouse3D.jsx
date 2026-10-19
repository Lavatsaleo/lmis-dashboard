import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { HOLD_COLOR, PALLET, palletColorFor } from "./layout";

const FLOOR = "#E7EBEE";
const SLOT = "#CBD5DC";
const WALL = "#94A3B8";
const DIM = new THREE.Color("#D5DCE3");
const HOLD = new THREE.Color(HOLD_COLOR);
const tierHeight = PALLET.base + PALLET.loadMax + 0.02;

// ---------------------------------------------------------------------------
// Procedural textures (drawn once, no downloads: works offline in the field)
// ---------------------------------------------------------------------------
const textureCache = {};
function makeTexture(key, size, draw, { repeat } = {}) {
  if (textureCache[key] || typeof document === "undefined") return textureCache[key];
  const canvas = document.createElement("canvas");
  canvas.width = size[0];
  canvas.height = size[1];
  draw(canvas.getContext("2d"), size[0], size[1]);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  textureCache[key] = t;
  return t;
}

// Brown cartons with the green product band, as on the RUTF cartons.
const cardboardTexture = () =>
  makeTexture("cardboard", [192, 320], (ctx, w, h) => {
    const rows = 10;
    const cols = 3;
    const ch = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const off = r % 2 ? cw / 2 : 0;
        for (const dx of [0, off ? -cw : 0]) {
          const x = c * cw + off + dx;
          const shade = 196 + ((r * 7 + c * 13) % 14);
          ctx.fillStyle = `rgb(${shade}, ${Math.round(shade * 0.8)}, ${Math.round(shade * 0.58)})`;
          ctx.fillRect(x, r * ch, cw, ch);
          ctx.fillStyle = "rgba(160, 206, 96, 0.9)";
          ctx.fillRect(x + cw * 0.18, r * ch + ch * 0.46, cw * 0.64, ch * 0.13);
          ctx.strokeStyle = "rgba(90, 64, 36, 0.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, r * ch + 1, cw - 2, ch - 2);
        }
      }
    }
  });

// Neutral seams, multiplied with a colour (expiry / product / donor modes).
const seamTexture = () =>
  makeTexture("seams", [192, 320], (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 3;
    const rows = 10;
    for (let r = 0; r <= rows; r += 1) {
      ctx.beginPath();
      ctx.moveTo(0, (r * h) / rows);
      ctx.lineTo(w, (r * h) / rows);
      ctx.stroke();
      const off = r % 2 ? w / 6 : 0;
      for (let x = off; x <= w; x += w / 3) {
        ctx.beginPath();
        ctx.moveTo(x, (r * h) / rows);
        ctx.lineTo(x, ((r + 1) * h) / rows);
        ctx.stroke();
      }
    }
  });

// Stacked white sacks (WFP style) with a faint blue print.
const sackTexture = () =>
  makeTexture("sack", [192, 256], (ctx, w, h) => {
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r += 1) {
      const off = r % 2 ? w / 4 : 0;
      for (let x = -w / 2 + off; x < w; x += w / 2) {
        const g = ctx.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
        g.addColorStop(0, "#f7f6f1");
        g.addColorStop(0.5, "#ebe8df");
        g.addColorStop(1, "#d6d2c6");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x + 2, r * rh + 2, w / 2 - 4, rh - 4, 10);
        ctx.fill();
        ctx.fillStyle = "rgba(37, 99, 170, 0.35)";
        ctx.fillRect(x + w / 8, r * rh + rh * 0.4, w / 4, rh * 0.18);
      }
    }
  });

// Beige tent canvas, darker and stained towards the bottom.
const canvasTexture = () =>
  makeTexture(
    "tent",
    [256, 256],
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#efe2c4");
      g.addColorStop(0.75, "#e2cfa6");
      g.addColorStop(1, "#bfa77a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i += 1) {
        const x = (i * 97) % w;
        ctx.fillStyle = `rgba(120, 88, 40, ${0.04 + ((i * 13) % 7) / 100})`;
        ctx.fillRect(x, h * (0.25 + ((i * 31) % 50) / 100), 2 + (i % 4), h);
      }
      ctx.strokeStyle = "rgba(150, 120, 70, 0.25)";
      for (let x = 0; x < w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    },
    { repeat: [6, 1] }
  );

// Sandy compacted floor.
const sandTexture = () =>
  makeTexture(
    "sand",
    [256, 256],
    (ctx, w, h) => {
      ctx.fillStyle = "#d4c097";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i += 1) {
        const x = (i * 7919) % w;
        const y = (i * 104729) % h;
        ctx.fillStyle = i % 3 ? "rgba(150,120,80,0.10)" : "rgba(255,245,220,0.12)";
        ctx.fillRect(x, y, 2, 2);
      }
    },
    { repeat: [4, 10] }
  );

// ---------------------------------------------------------------------------
// One instanced mesh for many boxes: fast even with thousands of pallets.
// ---------------------------------------------------------------------------
function Instanced({ items, place, color, onClick, onHover, opacity = 1, castShadow = true, map = null, roughness = 0.75 }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((item, i) => {
      const { position, scale } = place(item);
      o.position.set(...position);
      o.scale.set(...scale);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (color) {
        const value = color(item);
        mesh.setColorAt(i, value instanceof THREE.Color ? value : c.set(value));
      }
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, place, color]);

  if (!items.length) return null;
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(items[e.instanceId]);
            }
          : undefined
      }
      onPointerMove={
        onHover
          ? (e) => {
              e.stopPropagation();
              onHover(items[e.instanceId]);
            }
          : undefined
      }
      onPointerOut={onHover ? () => onHover(null) : undefined}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" map={map} roughness={roughness} metalness={0.02} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  );
}

const loadHeight = (p) => Math.max(0.16, PALLET.loadMax * p.fill);
const yBase = (p) => (p.level || 0) * tierHeight;

function Pallets({ layout, colorFor, isDimmed, realistic, onSelect, onHover }) {
  const { pallets } = layout;
  const P = layout.pallet || PALLET;
  // In a hall, empty floor positions show bare pallets (as on the photos).
  const emptySlots = useMemo(() => {
    if (layout.structure !== "RUBB_HALL") return [];
    const used = new Set(pallets.filter((p) => (p.level || 0) === 0).map((p) => p.slot));
    return layout.slots.map((s, i) => ({ ...s, slot: i })).filter((s) => !used.has(s.slot));
  }, [layout, pallets]);
  const bases = useMemo(() => [...pallets, ...emptySlots], [pallets, emptySlots]);
  const cartons = useMemo(() => pallets.filter((p) => !p.bag), [pallets]);
  const sacks = useMemo(() => pallets.filter((p) => p.bag), [pallets]);

  const placeBase = useMemo(
    () => (p) => ({ position: [p.x, yBase(p) + PALLET.base / 2, p.z], scale: [P.w, PALLET.base, P.d] }),
    [P]
  );
  const baseColor = useMemo(() => (p) => palletColorFor(p.slot || 0), []);
  const placeLoad = useMemo(
    () => (p) => {
      const h = loadHeight(p);
      const shrink = p.bag ? 0.9 : 0.96;
      return { position: [p.x, yBase(p) + PALLET.base + h / 2, p.z], scale: [P.w * shrink, h, P.d * shrink] };
    },
    [P]
  );
  const loadColor = useMemo(
    () => (p) => {
      const c = realistic ? new THREE.Color("#ffffff") : new THREE.Color(colorFor(p));
      if (p.held) c.lerp(HOLD, realistic ? 0.45 : 0.55);
      return isDimmed(p) ? c.lerp(DIM, 0.8) : c;
    },
    [colorFor, isDimmed, realistic]
  );

  return (
    <group>
      <Instanced items={bases} place={placeBase} color={baseColor} roughness={0.9} />
      <Instanced items={cartons} place={placeLoad} color={loadColor} onClick={onSelect} onHover={onHover} map={realistic ? cardboardTexture() : seamTexture()} />
      <Instanced items={sacks} place={placeLoad} color={loadColor} onClick={onSelect} onHover={onHover} map={sackTexture()} roughness={0.95} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rubb hall: steel portal frames, canvas walls and roof, gable ends with
// round vents, open door at the front, sandy floor and a central aisle.
// ---------------------------------------------------------------------------
function Beam({ from, to, radius = 0.07, color = "#aab0b6" }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: a.clone().add(b).multiplyScalar(0.5), quaternion: q, length: dir.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.45} />
    </mesh>
  );
}

function gableShape(W, eave, ridge, withDoor) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, eave);
  s.lineTo(0, ridge);
  s.lineTo(-W / 2, eave);
  s.closePath();
  for (const vx of [-0.55, 0.55]) {
    const v = new THREE.Path();
    v.absarc(vx, eave + 0.95, 0.36, 0, Math.PI * 2, false);
    s.holes.push(v);
  }
  if (withDoor) {
    const d = new THREE.Path();
    d.moveTo(-1.5, 0);
    d.lineTo(1.5, 0);
    d.lineTo(1.5, 3.1);
    d.lineTo(-1.5, 3.1);
    d.closePath();
    s.holes.push(d);
  }
  return s;
}

function RubbHall({ hall, showRoof, inside }) {
  const { width: W, length: L, eave, ridge } = hall;
  const frames = Math.max(2, Math.round(L / 4.5) + 1);
  const zs = Array.from({ length: frames }, (_, i) => -L / 2 + (i * L) / (frames - 1));
  const roofSlope = Math.hypot(W / 2, ridge - eave);
  const roofAngle = Math.atan2(ridge - eave, W / 2);
  const tent = canvasTexture();
  const backGable = useMemo(() => gableShape(W, eave, ridge, false), [W, eave, ridge]);
  const frontGable = useMemo(() => gableShape(W, eave, ridge, true), [W, eave, ridge]);
  // From inside the canvas is solid and glows with daylight (as in the
  // photos); from outside it is see-through so the stock stays visible.
  const canvasMat = (opacity) => (
    <meshStandardMaterial
      map={tent}
      color="#ffffff"
      emissive={inside ? "#d9c08e" : "#000000"}
      emissiveIntensity={inside ? 0.35 : 0}
      transparent={!inside}
      opacity={inside ? 1 : opacity}
      side={THREE.DoubleSide}
      depthWrite={inside}
      roughness={1}
    />
  );

  return (
    <group>
      {/* Floor and the yard outside the door */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial map={sandTexture()} color="#ffffff" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[W + 24, L + 24]} />
        <meshStandardMaterial color="#cdbb92" roughness={1} />
      </mesh>
      {/* Central aisle, slightly smoother */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <planeGeometry args={[hall.aisle - 0.2, L - 0.4]} />
        <meshStandardMaterial color="#dccaa3" roughness={1} transparent opacity={0.55} />
      </mesh>

      {/* Steel portal frames */}
      {zs.map((z) => (
        <group key={z}>
          <Beam from={[-W / 2, 0, z]} to={[-W / 2, eave, z]} />
          <Beam from={[W / 2, 0, z]} to={[W / 2, eave, z]} />
          <Beam from={[-W / 2, eave, z]} to={[0, ridge, z]} />
          <Beam from={[W / 2, eave, z]} to={[0, ridge, z]} />
        </group>
      ))}
      {/* Purlins along the length */}
      {[
        [-W / 2, eave],
        [W / 2, eave],
        [0, ridge],
        [-W / 4, (eave + ridge) / 2],
        [W / 4, (eave + ridge) / 2],
      ].map(([x, y]) => (
        <Beam key={`${x}-${y}`} from={[x, y, -L / 2]} to={[x, y, L / 2]} radius={0.045} />
      ))}

      {/* Canvas side walls */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * W) / 2, eave / 2, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
          <planeGeometry args={[L, eave]} />
          {canvasMat(0.42)}
        </mesh>
      ))}
      {/* Canvas roof (can be hidden to look inside from above) */}
      {showRoof
        ? [-1, 1].map((side) => (
            <mesh key={`r${side}`} position={[(side * W) / 4, (eave + ridge) / 2, 0]} rotation={[0, 0, -side * roofAngle]}>
              <boxGeometry args={[roofSlope, 0.02, L]} />
              {canvasMat(0.26)}
            </mesh>
          ))
        : null}
      {/* Gable ends: back closed, front with the open door */}
      <mesh position={[0, 0, -L / 2]}>
        <shapeGeometry args={[backGable]} />
        {canvasMat(0.5)}
      </mesh>
      <mesh position={[0, 0, L / 2]}>
        <shapeGeometry args={[frontGable]} />
        {canvasMat(0.5)}
      </mesh>
      {/* Daylight through the vents */}
      {[-0.55, 0.55].map((vx) =>
        [-L / 2 + 0.01, L / 2 - 0.01].map((z) => (
          <mesh key={`${vx}${z}`} position={[vx, eave + 0.95, z]}>
            <circleGeometry args={[0.36, 24]} />
            <meshBasicMaterial color="#f8fbff" side={THREE.DoubleSide} />
          </mesh>
        ))
      )}
      <Html position={[0, 3.6, L / 2 + 0.4]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div style={labelStyle("#7A5B00", "#FFF6D6")}>Door · earliest expiry stored nearest</div>
      </Html>
    </group>
  );
}

function Building({ layout }) {
  const { width, depth } = layout.floor;
  const placeSlot = useMemo(
    () => (s) => ({ position: [s.x, 0.005, s.z], scale: [PALLET.w + 0.12, 0.01, PALLET.d + 0.12] }),
    []
  );
  const slotColor = useMemo(() => () => SLOT, []);
  const wallH = 4.5;
  const t = 0.2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, depth / 2 + layout.dock.depth / 2]}>
        <planeGeometry args={[width, layout.dock.depth]} />
        <meshStandardMaterial color="#C9D1D8" roughness={1} />
      </mesh>
      <Instanced items={layout.slots} place={placeSlot} color={slotColor} castShadow={false} />
      <mesh position={[0, 0.02, depth / 2 - 0.15]}>
        <boxGeometry args={[width, 0.02, 0.18]} />
        <meshStandardMaterial color="#F2B705" />
      </mesh>
      {[
        { p: [0, wallH / 2, -depth / 2], s: [width, wallH, t] },
        { p: [-width / 2, wallH / 2, 0], s: [t, wallH, depth] },
        { p: [width / 2, wallH / 2, 0], s: [t, wallH, depth] },
      ].map((w, i) => (
        <mesh key={i} position={w.p}>
          <boxGeometry args={w.s} />
          <meshStandardMaterial color={WALL} transparent opacity={0.14} depthWrite={false} />
          <Edges color={WALL} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 - 0.6), wallH / 2, depth / 2]}>
          <boxGeometry args={[1.2, wallH, t]} />
          <meshStandardMaterial color={WALL} transparent opacity={0.3} />
        </mesh>
      ))}
      <Html position={[0, 0.1, depth / 2 + 0.9]} center zIndexRange={[10, 0]}>
        <div style={labelStyle("#7A5B00", "#FFF6D6")}>Dispatch dock · earliest expiry stored nearest</div>
      </Html>
    </group>
  );
}

function Incoming({ items }) {
  const place = useMemo(
    () => (g) => ({ position: [g.x, (PALLET.base + PALLET.loadMax) / 2, g.z], scale: [PALLET.w * 0.94, PALLET.base + PALLET.loadMax, PALLET.d * 0.94] }),
    []
  );
  const color = useMemo(() => () => "#3B82F6", []);
  if (!items.length) return null;
  const first = items[0];
  const boxes = [...new Map(items.map((i) => [i.shipment.id, i.shipment])).values()].reduce((s, x) => s + x.boxes, 0);
  return (
    <group>
      <Instanced items={items} place={place} color={color} opacity={0.35} castShadow={false} />
      <Html position={[first.x, 2.6, first.z]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div style={labelStyle("#1E40AF", "#DBEAFE")}>Incoming · {boxes} boxes in transit</div>
      </Html>
    </group>
  );
}

function Highlight({ pallet, label, color = "#0F172A", size = PALLET }) {
  if (!pallet) return null;
  const h = loadHeight(pallet);
  return (
    <group position={[pallet.x, yBase(pallet) + PALLET.base + h / 2, pallet.z]}>
      <mesh scale={[size.w * 1.08, h + 0.1, size.d * 1.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
        <Edges color={color} />
      </mesh>
      {label ? (
        <Html position={[0, h / 2 + 0.5, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ ...labelStyle("#0F172A", "#FFFFFF"), boxShadow: "0 4px 14px rgba(15,23,42,.18)" }}>{label}</div>
        </Html>
      ) : null}
    </group>
  );
}

function labelStyle(color, bg) {
  return {
    color,
    background: bg,
    border: `1px solid ${color}33`,
    borderRadius: 8,
    padding: "4px 8px",
    font: "600 12px Inter, system-ui, sans-serif",
    whiteSpace: "nowrap",
    userSelect: "none",
  };
}

/** Moves the camera when a view preset is chosen. */
function CameraPreset({ preset, layout }) {
  // Read the camera from the store inside the effect: three.js objects are
  // mutable by design, but the React linter forbids mutating hook values.
  const get = useThree((state) => state.get);
  const controlsReady = useThree((state) => !!state.controls);
  useEffect(() => {
    const { camera, controls } = get();
    const { width, depth } = layout.floor;
    const span = Math.max(width, depth);
    let pos;
    let target;
    if (preset === "inside" && layout.structure === "RUBB_HALL") {
      // Standing in the doorway looking down the aisle, like the photos.
      pos = [0.6, 1.7, depth / 2 + 1.2];
      target = [0, 1.4, -depth / 2];
      camera.fov = 62;
    } else if (preset === "top") {
      pos = [0.01, span * 1.25, 0.01];
      target = [0, 0, 0];
      camera.fov = 40;
    } else {
      pos = layout.structure === "RUBB_HALL" ? [width * 1.6, depth * 0.55, depth / 2 + depth * 0.45] : [span * 0.62, span * 0.72, depth / 2 + span * 0.78];
      target = [0, 0.8, 0];
      camera.fov = 38;
    }
    camera.position.set(...pos);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(...target);
      controls.update();
    } else {
      camera.lookAt(...target);
    }
  }, [preset, layout, get, controlsReady]);
  return null;
}

/**
 * Interactive 3D warehouse. Rotate by dragging, zoom with the wheel/pinch,
 * click a pallet to inspect it.
 */
export default function Warehouse3D({ layout, colorFor, isDimmed, selected, onSelect, height = 520, realistic = false, preset = "overview", showRoof = true }) {
  const [hovered, setHovered] = useState(null);
  const { width, depth } = layout.floor;
  const span = Math.max(width, depth);
  const hoverLabel = (p) => `${p.batch.productName} · ${p.batch.batchNo} · ${p.boxes} ${p.bag ? "bags" : "boxes"}${p.held ? " · ON HOLD" : ""}`;
  const isHall = layout.structure === "RUBB_HALL";

  return (
    <div style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", background: isHall ? "linear-gradient(#cfe3f3, #efe6d2)" : "linear-gradient(#F4F7F9, #E3E9EE)", cursor: hovered ? "pointer" : "grab" }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span, span, span], fov: 40, near: 0.1, far: span * 12 }} onPointerMissed={() => onSelect(null)}>
        <ambientLight intensity={isHall ? 0.75 : 0.65} />
        {/* Sun through the canvas: warm, soft light */}
        <hemisphereLight args={[isHall ? "#fff4dc" : "#ffffff", isHall ? "#b59b6c" : "#CBD5E1", 0.55]} />
        <directionalLight
          position={[span * 0.4, span * 0.9, span * 0.3]}
          intensity={isHall ? 0.9 : 1.1}
          color={isHall ? "#fff1d6" : "#ffffff"}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-span}
          shadow-camera-right={span}
          shadow-camera-top={span}
          shadow-camera-bottom={-span}
        />
        {isHall ? <RubbHall hall={layout.hall} showRoof={showRoof || preset === "inside"} inside={preset === "inside"} /> : <Building layout={layout} />}
        <Pallets layout={layout} colorFor={colorFor} isDimmed={isDimmed} realistic={realistic} onSelect={onSelect} onHover={setHovered} />
        <Incoming items={layout.incoming} />
        <Highlight pallet={selected} label={selected ? hoverLabel(selected) : null} color="#0F172A" size={layout.pallet || PALLET} />
        {hovered && hovered !== selected ? <Highlight pallet={hovered} label={hoverLabel(hovered)} color="#0098B4" size={layout.pallet || PALLET} /> : null}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.05} minDistance={1.5} maxDistance={span * 3} enableDamping />
        <CameraPreset preset={preset} layout={layout} />
      </Canvas>
    </div>
  );
}
