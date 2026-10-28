// Prints every line the guided meditations can speak (all sessions × 1/3/5 min, every Reflect theme, breath cues,
// and the Test button line) as JSON. Used by tools/meditation_audio.py to record them.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = fs.readFileSync(path.join(root, 'life-os.js'), 'utf8');
const start = js.indexOf('const MED_TEST_LINE');
const end = js.indexOf('class LifeOS');
const { MEDITATIONS, BREATH_PATTERNS, MED_TEST_LINE } = new Function(
    `${js.slice(start, end)}; return { MEDITATIONS, BREATH_PATTERNS, MED_TEST_LINE };`)();

const lines = new Set([MED_TEST_LINE]);
for (const session of Object.values(MEDITATIONS)) {
    for (const theme of session.themes || [undefined]) { // Reflect: every daily theme
        for (const min of [1, 3, 5]) {
            session.build(min, theme).forEach(step => { if (step.say) lines.add(step.say); });
        }
    }
}
for (const phases of Object.values(BREATH_PATTERNS)) {
    phases.forEach(p => { if (p.cue) lines.add(p.cue); });
}
console.log(JSON.stringify([...lines], null, 2));
