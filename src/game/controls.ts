import type { Vec2 } from '../../shared/protocol';
import { clamp, normalize } from './utils';

export type InputState = {
  target: Vec2;
  usingJoystick: boolean;
};

export const setupControls = (canvas: HTMLCanvasElement, joystickEl: HTMLDivElement, stickEl: HTMLDivElement) => {
  const state: InputState = {
    target: { x: 0, y: 0 },
    usingJoystick: false
  };

  const rectToWorld = (clientX: number, clientY: number): Vec2 => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr
    };
  };

  const updateTarget = (clientX: number, clientY: number) => {
    state.target = rectToWorld(clientX, clientY);
  };

  canvas.addEventListener('pointermove', (e) => {
    if (!state.usingJoystick) updateTarget(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerdown', (e) => {
    state.usingJoystick = false;
    updateTarget(e.clientX, e.clientY);
  });

  const joy = {
    active: false,
    center: { x: 0, y: 0 },
    pointerId: -1
  };

  const updateStick = (dx: number, dy: number) => {
    const radius = 46;
    const dist = Math.hypot(dx, dy);
    const clamped = dist > radius ? radius / dist : 1;
    const pos = { x: dx * clamped, y: dy * clamped };
    stickEl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    joy.active = true;
    joy.pointerId = e.pointerId;
    joy.center = { x: e.clientX, y: e.clientY };
    state.usingJoystick = true;
    joystickEl.classList.add('active');
    updateStick(0, 0);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!joy.active || e.pointerId !== joy.pointerId) return;
    const dx = e.clientX - joy.center.x;
    const dy = e.clientY - joy.center.y;
    updateStick(dx, dy);
    const norm = normalize({ x: dx, y: dy });
    const dist = clamp(Math.hypot(dx, dy) / 60, 0, 1);
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const target = {
      x: (rect.left + rect.width * 0.5 + norm.x * rect.width * 0.35 * dist - rect.left) * dpr,
      y: (rect.top + rect.height * 0.5 + norm.y * rect.height * 0.35 * dist - rect.top) * dpr
    };
    state.target = target;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== joy.pointerId) return;
    joy.active = false;
    joy.pointerId = -1;
    state.usingJoystick = false;
    joystickEl.classList.remove('active');
    stickEl.style.transform = 'translate(0px, 0px)';
  };

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return state;
};
