import {
  AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild,
  effect, inject, signal,
} from '@angular/core';
import * as THREE from 'three';
import { ThemeService } from '../../../services/theme.service';

// Spinnable 3D point cloud of a vehicle, baked from a .blend into a compact
// binary (see client/public/models/*.bin — layout: 'PCLD' magic, uint32 version,
// uint32 count, then float32 XYZ * count, three.js Y-up, centered, unit-scaled).
//
// Rendered as a single THREE.Points cloud tinted with the theme accent
// (--obd-blue, re-read on theme change), so it reads as a scanned/instrument
// hologram rather than a solid car. Auto-rotates slowly; drag to spin. Honors
// prefers-reduced-motion (no auto-spin) and pauses the render loop when the
// canvas is offscreen or the tab is hidden, so it costs nothing when unseen.
//
//   <app-vehicle-cloud src="/models/wrx-sti.bin" />
@Component({
  selector: 'app-vehicle-cloud',
  standalone: true,
  template: `
    <div #host class="vc-host" [class.vc-loading]="loading()" [class.vc-error]="!!error()">
      <canvas #canvas class="vc-canvas"
              (pointerdown)="onPointerDown($event)"
              (pointermove)="onPointerMove($event)"
              (pointerup)="onPointerUp($event)"
              (pointerleave)="onPointerUp($event)"></canvas>
      @if (loading()) {
        <div class="vc-status" aria-live="polite">
          <span class="vc-prompt">scan$</span> loading point cloud…
        </div>
      }
      @if (error()) {
        <div class="vc-status vc-status--err" role="alert">
          <span class="vc-prompt">scan$</span> {{ error() }}
        </div>
      }
    </div>
  `,
  styleUrl: './vehicle-cloud.component.scss',
})
export class VehicleCloudComponent implements AfterViewInit, OnDestroy {
  private readonly theme = inject(ThemeService);

  /** Path to the baked .bin cloud (served from client/public). */
  @Input() src = '/models/wrx-sti.bin';
  /** Base point size in world units; auto-scaled by device pixel ratio. */
  @Input() pointSize = 0.006;

  @ViewChild('host') hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private points?: THREE.Points;
  private material?: THREE.PointsMaterial;

  private rafId = 0;
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  private visible = true;         // canvas intersects the viewport
  private tabVisible = true;      // document not hidden
  private readonly reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Drag-to-spin state.
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private yaw = 0.6;              // current rotation about Y (radians)
  private pitch = 0.1;            // current rotation about X, clamped
  private spinVel = 0;            // residual yaw velocity after a drag (inertia)

  private readonly onDocVisibility = () => {
    this.tabVisible = !document.hidden;
    this.syncLoop();
  };

  constructor() {
    // Re-tint the cloud whenever the theme flips (accent differs per theme).
    effect(() => {
      this.theme.theme();               // track
      if (this.material) this.applyAccent();
    });
  }

  ngAfterViewInit(): void {
    this.initThree();
    this.load();
    document.addEventListener('visibilitychange', this.onDocVisibility);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this.onDocVisibility);
    this.ro?.disconnect();
    this.io?.disconnect();
    this.points?.geometry.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.55, 3.7);
    camera.lookAt(0, -0.05, 0);
    this.camera = camera;

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.hostRef.nativeElement);

    // Pause the loop when the canvas scrolls out of view.
    this.io = new IntersectionObserver(
      entries => { this.visible = entries[0]?.isIntersecting ?? true; this.syncLoop(); },
      { threshold: 0.01 },
    );
    this.io.observe(this.hostRef.nativeElement);
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch(this.src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const positions = this.parseCloud(buf);

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.computeBoundingSphere();

      const mat = new THREE.PointsMaterial({
        size: this.pointSize,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      this.material = mat;
      this.applyAccent();

      this.points = new THREE.Points(geom, mat);
      this.scene!.add(this.points);

      this.loading.set(false);
      this.syncLoop();
    } catch (e) {
      this.error.set('cloud unavailable');
      this.loading.set(false);
      console.warn('vehicle-cloud load failed:', e);
    }
  }

  /** Parse the 'PCLD' binary into a Float32Array of XYZ positions. */
  private parseCloud(buf: ArrayBuffer): Float32Array {
    const dv = new DataView(buf);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'PCLD') throw new Error('bad magic');
    const count = dv.getUint32(8, true);
    // Positions start at byte 12; copy so the array owns aligned storage.
    return new Float32Array(buf.slice(12, 12 + count * 3 * 4));
  }

  /** Read the theme accent from CSS and apply it to the point material. */
  private applyAccent(): void {
    if (!this.material) return;
    const css = getComputedStyle(this.hostRef.nativeElement)
      .getPropertyValue('--obd-blue').trim() || '#3b82f6';
    this.material.color = new THREE.Color(css);
    this.material.needsUpdate = true;
  }

  // ── Render loop ─────────────────────────────────────────────────────────────
  private syncLoop(): void {
    const shouldRun = this.visible && this.tabVisible && !this.error() && !!this.points;
    if (shouldRun && !this.rafId) {
      this.rafId = requestAnimationFrame(this.tick);
    } else if (!shouldRun && this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private readonly tick = (): void => {
    this.rafId = 0;
    if (this.points) {
      if (this.dragging) {
        // no auto motion while the user holds
      } else if (this.spinVel !== 0) {
        this.yaw += this.spinVel;
        this.spinVel *= 0.94;                    // inertia decay
        if (Math.abs(this.spinVel) < 0.0002) this.spinVel = 0;
      } else if (!this.reduceMotion) {
        this.yaw += 0.0025;                      // gentle idle auto-spin
      }
      this.points.rotation.y = this.yaw;
      this.points.rotation.x = this.pitch;
    }
    this.renderer!.render(this.scene!, this.camera!);
    this.syncLoop();
  };

  private resize(): void {
    const host = this.hostRef?.nativeElement;
    if (!host || !this.renderer || !this.camera) return;
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.rafId === 0) this.renderer.render(this.scene!, this.camera!); // paint once when idle
  }

  // ── Drag-to-spin ────────────────────────────────────────────────────────────
  onPointerDown(e: PointerEvent): void {
    this.dragging = true;
    this.spinVel = 0;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yaw += dx * 0.008;
    this.spinVel = dx * 0.008;                   // carry into inertia on release
    this.pitch = Math.max(-0.5, Math.min(0.5, this.pitch + dy * 0.005));
    this.syncLoop();
  }

  onPointerUp(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }
}
