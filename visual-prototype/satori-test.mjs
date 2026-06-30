import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
const arial = fs.readFileSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf');
const node = {
  type: 'div',
  props: {
    style: { width: '800px', height: '300px', background: '#07162E', display: 'flex', flexDirection: 'column',
             justifyContent: 'center', alignItems: 'flex-end', padding: '40px', direction: 'rtl' },
    children: [
      { type: 'div', props: { style: { color: '#fff', fontSize: 54, fontWeight: 800 }, children: 'ההגנה האמיתית מתחילה' } },
      { type: 'div', props: { style: { color: '#5AB0FF', fontSize: 54, fontWeight: 800 }, children: 'לפני המתקפה' } },
      { type: 'div', props: { style: { color: '#9FC4F0', fontSize: 26, fontWeight: 800, marginTop: '14px' }, children: 'English check: inference' } },
    ],
  },
};
const svg = await satori(node, { width: 800, height: 300, fonts: [{ name: 'Arial', data: arial, weight: 800, style: 'normal' }] });
fs.writeFileSync('he-satori-test.png', new Resvg(svg).render().asPng());
console.log('ok');
