import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MathUtils,
  Path,
  Shape,
  ShapeGeometry,
  type Group,
  type Mesh,
   MeshBasicMaterial,
   ShaderMaterial,
} from 'three';

interface PanelFrameProps {
  width: number;
  height: number;
  text: string;
  textSize?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  accentColor: string;
  /** Optional second gradient stop. Falls back to a hue-shifted accent. */
  accentColorSecondary?: string;
  selected?: boolean;
  dimmed?: boolean;
  variant?: 'header' | 'choice';
  onClick?: () => void;
}

const Z = 0.012; // z-step between stacked layers
const CORNER_RADIUS = 0.06;
const FRAME_THICKNESS = 0.018;
const BRACKET_THICK = 0.014;

// geometry 
function roundedRectShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedRectPath(w: number, h: number, r: number): Path {
  const p = new Path();
  const x = -w / 2;
  const y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

// Rounded-rect ring (outline only) used for the glowing border. 
function frameGeometry(w: number, h: number, r: number, t: number): ShapeGeometry {
  const outer = roundedRectShape(w, h, r);
  outer.holes.push(roundedRectPath(w - t * 2, h - t * 2, Math.max(0.001, r - t)));
  return new ShapeGeometry(outer, 18);
}

// L-shaped corner bracket, elbow at origin, arms toward +x / +y.
function bracketGeometry(len: number, t: number): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(len, 0);
  s.lineTo(len, t);
  s.lineTo(t, t);
  s.lineTo(t, len);
  s.lineTo(0, len);
  s.closePath();
  return new ShapeGeometry(s);
}

// shaders
const BORDER_VERT = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Gradient that wraps around the frame + a bright glint that orbits the perimeter.
const BORDER_FRAG = /* glsl */ `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2  vPos;
  const float TAU = 6.28318530718;

  void main() {
    float ang = atan(vPos.y, vPos.x) / TAU + 0.5;      // 0..1 around the frame
    float g   = abs(sin((ang + uTime * 0.05) * 3.14159265));
    vec3  col = mix(uColorA, uColorB, g);

    float head  = fract(ang - uTime * 0.16);           // travelling highlight
    float glint = smoothstep(0.88, 1.0, 1.0 - abs(head - 0.5) * 2.0);
    col += glint * 1.6;

    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

const HALO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uStrength;
  varying vec2  vUv;
  void main() {
    float d = distance(vUv, vec2(0.5));
    float a = smoothstep(0.5, 0.04, d);
    gl_FragColor = vec4(uColor, a * a * uStrength);
  }
`;

// component 
export function PanelFrame({
  width,
  height,
  text,
  textSize = 0.08,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  visible = true,
  accentColor,
  accentColorSecondary,
  selected = false,
  dimmed = false,
  variant = 'choice',
  onClick,
}: PanelFrameProps) {
  const groupRef = useRef<Group>(null); // visibility scale-in
  const contentRef = useRef<Group>(null); // selected / dimmed scale
  const scanRef = useRef<Mesh>(null);
  const dotRef = useRef<Mesh>(null);

  const visibilityChangedAt = useRef<number | null>(null);
  const wasVisible = useRef(false);

  const colA = useMemo(() => new Color(accentColor), [accentColor]);
  const colB = useMemo(() => {
    if (accentColorSecondary) return new Color(accentColorSecondary);
    const c = new Color(accentColor);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL((hsl.h + 0.42) % 1, hsl.s, hsl.l);
    return c;
  }, [accentColor, accentColorSecondary]);

  const accentBright = useMemo(() => colA.clone().multiplyScalar(2.4), [colA]);

  /* geometries (memoised per size) */
  const frameGeo = useMemo(
    () => frameGeometry(width, height, CORNER_RADIUS, FRAME_THICKNESS),
    [width, height],
  );
  const fillGeo = useMemo(
    () => new ShapeGeometry(roundedRectShape(width, height, CORNER_RADIUS), 18),
    [width, height],
  );
  const glowGeo = useMemo(
    () =>
      new ShapeGeometry(
        roundedRectShape(width - 0.05, height - 0.05, CORNER_RADIUS * 0.8),
        18,
      ),
    [width, height],
  );
  const bracketLen = Math.min(0.18, height * 0.42, width * 0.26);
  const bracketGeo = useMemo(
    () => bracketGeometry(bracketLen, BRACKET_THICK),
    [bracketLen],
  );

  /* materials */
  const borderMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColorA: { value: colA.clone() },
          uColorB: { value: colB.clone() },
          uTime: { value: 0 },
          uIntensity: { value: 1 },
        },
        vertexShader: BORDER_VERT,
        fragmentShader: BORDER_FRAG,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
      }),
    [colA, colB],
  );

  const haloMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: colA.clone() },
          uStrength: { value: 0.3 },
        },
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: AdditiveBlending,
      }),
    [colA],
  );

  const fillMat = useRef<MeshBasicMaterial>(null);
  const glowMat = useRef<MeshBasicMaterial>(null);
  const bracketMat = useMemo(
    () =>
      new (class extends MeshBasicMaterial {})({
        color: accentBright.clone(),
        toneMapped: false,
        transparent: true,
        depthWrite: false,
      }),
    [accentBright],
  );

  /* bracket placements: [x, y, zRot] */
  const inset = FRAME_THICKNESS + 0.012;
  const brackets: Array<[number, number, number]> = [
    [-width / 2 + inset, -height / 2 + inset, 0], // BL
    [width / 2 - inset, -height / 2 + inset, Math.PI / 2], // BR
    [width / 2 - inset, height / 2 - inset, Math.PI], // TR
    [-width / 2 + inset, height / 2 - inset, -Math.PI / 2], // TL
  ];

  /* top-left "tech tick" cluster positions */
  const tickX = -width / 2 + 0.085;
  const tickY = height / 2 - 0.055;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const group = groupRef.current;
    if (!group) return;

    // Track when visibility flipped
    if (visible && !wasVisible.current) {
        visibilityChangedAt.current = t;
        wasVisible.current = true;
    } else if (!visible && wasVisible.current) {
        visibilityChangedAt.current = t;
        wasVisible.current = false;
    }

    // Emergence/collapse animation
    let scaleTarget: number;
    if (visible) {
        const elapsed = visibilityChangedAt.current
        ? t - visibilityChangedAt.current
        : Infinity;
        if (elapsed < 0.45) {
        // Emergence curve: rapid grow with overshoot
        const progress = elapsed / 0.45;
        // Custom curve: starts at 0, overshoots 1.08 at ~0.7, settles to 1
        const overshoot = 1.08;
        if (progress < 0.7) {
            // Accelerate to overshoot
            const localT = progress / 0.7;
            const eased = 1 - Math.pow(1 - localT, 2);
            scaleTarget = overshoot * eased;
        } else {
            // Settle from overshoot to 1
            const localT = (progress - 0.7) / 0.3;
            scaleTarget = overshoot - (overshoot - 1) * localT;
        }
        } else {
        scaleTarget = 1;
        }
    } else {
        // Collapse: faster contract, slight inward acceleration
        const elapsed = visibilityChangedAt.current
        ? t - visibilityChangedAt.current
        : Infinity;
        if (elapsed < 0.3) {
        const progress = elapsed / 0.3;
        scaleTarget = 1 - Math.pow(progress, 2);
        } else {
        scaleTarget = 0;
        }
    }

    group.scale.setScalar(scaleTarget);
    group.visible = scaleTarget > 0.005;
    if (!visible && scaleTarget <= 0.005) return;


    // selected / dimmed content scale
    if (contentRef.current) {
      const s = selected ? 1.045 : dimmed ? 0.94 : 1;
      contentRef.current.scale.setScalar(
        MathUtils.lerp(contentRef.current.scale.x, s, 0.15),
      );
    }

    // border shimmer + intensity
    borderMat.uniforms.uTime.value = t;
    const bi = selected ? 1.75 : dimmed ? 0.4 : 1.0;
    borderMat.uniforms.uIntensity.value = MathUtils.lerp(
      borderMat.uniforms.uIntensity.value,
      bi,
      0.15,
    );

    // Compute emergence boost — extra intensity during the first 0.5s of being visible
    let emergenceBoost = 1;
    if (visible && visibilityChangedAt.current) {
    const elapsed = t - visibilityChangedAt.current;
    if (elapsed < 0.5) {
        // Bright at start, decays to normal
        emergenceBoost = 1 + (1 - elapsed / 0.5) * 1.5;
    }
    }

    borderMat.uniforms.uIntensity.value = MathUtils.lerp(
    borderMat.uniforms.uIntensity.value,
    bi * emergenceBoost,    // multiply normal intensity by emergence boost
    0.15,
    );

    // halo strength
    const hs = selected ? 0.55 : dimmed ? 0.08 : 0.3;
    haloMat.uniforms.uStrength.value = MathUtils.lerp(
      haloMat.uniforms.uStrength.value,
      hs,
      0.12,
    );

    // fill + inner glow opacity
    if (fillMat.current) {
      const o = selected ? 0.9 : dimmed ? 0.4 : 0.8;
      fillMat.current.opacity = MathUtils.lerp(fillMat.current.opacity, o, 0.15);
    }
    if (glowMat.current) {
      const o = selected ? 0.32 : dimmed ? 0.05 : 0.14;
      glowMat.current.opacity = MathUtils.lerp(glowMat.current.opacity, o, 0.15);
    }

    // bracket brightness (pulses when selected)
    const pulse = selected ? 1.4 + Math.sin(t * 6) * 0.4 : dimmed ? 0.5 : 1;
    bracketMat.color.copy(accentBright).multiplyScalar(pulse);

    // scan-line sweep
    if (scanRef.current) {
      const cyc = (t * 0.35 + position[1] * 0.13) % 1; // offset per panel
      scanRef.current.position.y = MathUtils.lerp(
        -height / 2 + 0.06,
        height / 2 - 0.06,
        cyc,
      );
      const mat = scanRef.current.material as MeshBasicMaterial;
      const fade = Math.sin(cyc * Math.PI);
      mat.opacity = fade * (selected ? 0.5 : dimmed ? 0.06 : 0.26);
    }

    // status dot blink
    if (dotRef.current) {
      const mat = dotRef.current.material as MeshBasicMaterial;
      mat.opacity = 0.25 + Math.abs(Math.sin(t * 2.2)) * 0.75;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={0}>
      {/* soft bloom halo behind everything */}
      <mesh position={[0, 0, -Z * 3]} material={haloMat}>
        <planeGeometry args={[width * 1.55, height * 1.7]} />
      </mesh>

      <group ref={contentRef}>
        {/* dark fill */}
        <mesh
          geometry={fillGeo}
          position={[0, 0, 0]}
          onClick={
            onClick
              ? (e) => {
                  e.stopPropagation();
                  onClick();
                }
              : undefined
          }
        >
          <meshBasicMaterial
            ref={fillMat}
            color="#05021a"
            transparent
            opacity={0.8}
            toneMapped={false}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>

        {/* inner accent wash */}
        <mesh geometry={glowGeo} position={[0, 0, Z]}>
          <meshBasicMaterial
            ref={glowMat}
            color={accentColor}
            transparent
            opacity={0.14}
            toneMapped={false}
            depthWrite={false}
            blending={AdditiveBlending}
            side={DoubleSide}
          />
        </mesh>

        {/* glowing gradient border */}
        <mesh geometry={frameGeo} material={borderMat} position={[0, 0, Z * 2]} />

        {/* scan line */}
        <mesh ref={scanRef} position={[0, 0, Z * 2.2]}>
          <planeGeometry args={[width - 0.08, 0.01]} />
          <meshBasicMaterial
            color={accentBright}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>

        {/* corner brackets */}
        {brackets.map(([x, y, rz], i) => (
          <mesh
            key={i}
            geometry={bracketGeo}
            material={bracketMat}
            position={[x, y, Z * 3]}
            rotation={[0, 0, rz]}
          />
        ))}

        {/* top-left tech ticks */}
        {[0, 1, 2].map((i) => (
          <mesh
            key={`tick-${i}`}
            material={bracketMat}
            position={[tickX + i * 0.032, tickY, Z * 3]}
          >
            <planeGeometry args={[0.006, 0.028]} />
          </mesh>
        ))}

        {/* blinking status dot (top-right) */}
        <mesh ref={dotRef} position={[width / 2 - 0.06, height / 2 - 0.055, Z * 3]}>
          <circleGeometry args={[0.013, 16]} />
          <meshBasicMaterial color={accentBright} transparent toneMapped={false} depthWrite={false} />
        </mesh>

        {/* header underline accent */}
        {variant === 'header' && (
          <mesh position={[0, -height / 2 + 0.07, Z * 2.5]}>
            <planeGeometry args={[width * 0.5, 0.006]} />
            <meshBasicMaterial
              color={accentBright}
              transparent
              opacity={0.8}
              toneMapped={false}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        )}

        {/* text */}
        <Text
          position={[0, variant === 'header' ? 0.04 : 0, Z * 4]}
          fontSize={textSize}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={width * 0.86}
          textAlign="center"
          letterSpacing={0.05}
          outlineWidth={0.003}
          outlineColor="#000000"
          outlineOpacity={0.85}
        >
          {text}
        </Text>
      </group>
    </group>
  );
}