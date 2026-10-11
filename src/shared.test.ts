import { describe,it,expect } from 'vitest';
import { blankScene, timelineDuration, plannedSceneCount, normalizeSceneOrder } from './shared';
describe('storyboard time model',()=>{
  it('sums scene durations independently of target duration',()=>{
    expect(timelineDuration([{durationSec:5},{durationSec:7},{durationSec:3}])).toBe(15);
  });
  it('calculates scenes for five second cuts',()=>{
    expect(plannedSceneCount(120)).toBe(24);
    expect(plannedSceneCount(11)).toBe(3);
  });
  it('starts each scene with a distinct ID and without a reference',()=>{
    const first=blankScene(1), second=blankScene(2);
    expect(first.id).not.toBe(second.id);
    expect(first.referenceAssetId).toBe(null);
    expect(first.durationSec).toBe(5);
  });
  it('reordering never changes the original scenes',()=>{
    const scenes=[blankScene(1),blankScene(2)];
    const reordered=normalizeSceneOrder([...scenes].reverse());
    reordered[0].title='Editado';
    expect(scenes[1].title).toBe('Cena 2');
  });
});
