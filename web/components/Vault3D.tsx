"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Vault3DProps {
  monthlyFlow: { month: string; in: number; out: number; transfer: number }[];
}

export default function Vault3D({ monthlyFlow }: Vault3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const width = el.clientWidth;
    const height = 360;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf4ecd8, 18, 38);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 6, 14);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    // Lighting — warm gold key light + cool emerald fill
    const ambient = new THREE.AmbientLight(0xfaf3df, 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xc4a062, 1.2);
    key.position.set(5, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x1a3d2e, 0.4);
    fill.position.set(-6, 4, -3);
    scene.add(fill);

    // Ground plane (parchment)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(20, 64),
      new THREE.MeshStandardMaterial({ color: 0xebe1c5, roughness: 0.95, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Bars representing monthly flow
    const months = monthlyFlow.slice(-6);
    const barWidth = 0.9;
    const barGap = 0.4;
    const totalWidth = months.length * (barWidth + barGap) - barGap;
    const startX = -totalWidth / 2 + barWidth / 2;

    const maxFlow = Math.max(1, ...months.map((m) => Math.max(m.in, m.out)));
    const bars: { mesh: THREE.Mesh; targetH: number }[] = [];

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xc4a062, metalness: 0.85, roughness: 0.25, emissive: 0x4a3517, emissiveIntensity: 0.15,
    });
    const claretMat = new THREE.MeshStandardMaterial({
      color: 0x6e1f2a, metalness: 0.55, roughness: 0.4, emissive: 0x2a0a0f, emissiveIntensity: 0.1,
    });
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x1a3d2e, metalness: 0.55, roughness: 0.4, emissive: 0x081610, emissiveIntensity: 0.1,
    });

    months.forEach((m, i) => {
      const x = startX + i * (barWidth + barGap);
      // Receipts (gold/emerald, taller=more)
      const inH = Math.max(0.05, (m.in / maxFlow) * 4.5);
      const inMesh = new THREE.Mesh(
        new THREE.BoxGeometry(barWidth, inH, 0.7),
        emeraldMat
      );
      inMesh.position.set(x - 0.45, inH / 2 - 0.5, -0.5);
      inMesh.castShadow = true;
      inMesh.receiveShadow = true;
      inMesh.scale.y = 0.001;
      scene.add(inMesh);
      bars.push({ mesh: inMesh, targetH: 1 });

      // Expenditures (claret)
      const outH = Math.max(0.05, (m.out / maxFlow) * 4.5);
      const outMesh = new THREE.Mesh(
        new THREE.BoxGeometry(barWidth, outH, 0.7),
        claretMat
      );
      outMesh.position.set(x + 0.45, outH / 2 - 0.5, -0.5);
      outMesh.castShadow = true;
      outMesh.scale.y = 0.001;
      scene.add(outMesh);
      bars.push({ mesh: outMesh, targetH: 1 });
    });

    // Floating coin (decorative)
    const coinGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 48);
    const coin = new THREE.Mesh(coinGeom, goldMat);
    coin.position.set(-totalWidth / 2 - 1.5, 1.4, 0.5);
    coin.rotation.x = Math.PI / 2.2;
    coin.castShadow = true;
    scene.add(coin);

    const coin2 = new THREE.Mesh(coinGeom, goldMat);
    coin2.position.set(totalWidth / 2 + 1.5, 1.8, 0.3);
    coin2.rotation.x = Math.PI / 2.4;
    coin2.castShadow = true;
    scene.add(coin2);

    // Animate
    let frame = 0;
    let raf = 0;
    const animate = () => {
      frame++;
      bars.forEach((b, idx) => {
        const t = Math.min(1, frame / 90 - idx * 0.04);
        if (t > 0) {
          b.mesh.scale.y = THREE.MathUtils.lerp(b.mesh.scale.y, 1, 0.06 * Math.min(1, t));
        }
      });
      coin.rotation.z += 0.01;
      coin.position.y = 1.4 + Math.sin(frame * 0.02) * 0.15;
      coin2.rotation.z -= 0.008;
      coin2.position.y = 1.8 + Math.cos(frame * 0.025) * 0.1;

      // Subtle camera orbit
      const t = frame * 0.002;
      camera.position.x = Math.sin(t) * 1.5;
      camera.lookAt(0, 1, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      goldMat.dispose(); claretMat.dispose(); emeraldMat.dispose();
      bars.forEach((b) => b.mesh.geometry.dispose());
      coinGeom.dispose();
    };
  }, [monthlyFlow]);

  return (
    <div className="relative overflow-hidden rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[color:var(--color-parch-light)] shadow-[0_8px_40px_-15px_rgba(28,24,20,0.25)]">
      <div className="absolute left-6 top-6 z-10 max-w-xs">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-gold-deep)]">
          The Vault
        </div>
        <div className="mt-2 font-display text-2xl italic leading-tight text-[color:var(--color-ink)]">
          Six months of <em>cash flow</em>
        </div>
        <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-ink-mute)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[color:var(--color-emerald-royal)]" /> Received
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-[color:var(--color-claret)]" /> Expended
          </span>
        </div>
      </div>
      <div ref={containerRef} className="h-[360px] w-full" />
    </div>
  );
}
