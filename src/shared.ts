export type AspectRatio = '9:16' | '16:9' | '1:1';
export interface Project { id: string; title: string; brief: string; style: string; aspectRatio: AspectRatio; targetDuration: number; createdAt: string; updatedAt: string; sceneCount?: number }
export interface Scene { id: string; title: string; narration: string; visualPrompt: string; motionPrompt: string; durationSec: number; referenceAssetId: string | null }
export interface Asset { id: string; filename: string; mimeType: string; byteSize: number; createdAt: string }
export interface Simulation { id: string; sceneCount: number; durationSec: number; status: 'simulated'; createdAt: string }
export interface ProjectDetail { project: Project; scenes: Scene[]; assets: Asset[]; simulations: Simulation[] }

export const PRESETS = ['Animação 3D educativa','Cinema 3D estilizado','Ilustração 2D','Realista','Produto comercial'] as const;
export const blankScene = (number: number): Scene => ({ id: crypto.randomUUID(), title: 'Cena ' + number, narration: '', visualPrompt: '', motionPrompt: '', durationSec: 5, referenceAssetId: null });
export const timelineDuration = (scenes: Pick<Scene,'durationSec'>[]): number => scenes.reduce((n, scene) => n + scene.durationSec, 0);
export const plannedSceneCount = (duration: number): number => Math.ceil(duration / 5);
export function normalizeSceneOrder(scenes: Scene[]): Scene[] { return scenes.map(scene => ({ ...scene })); }
