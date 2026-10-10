import { describe, expect, it } from 'vitest';
import { center, type MapView } from './geometry';
import { routeInk, walkedRooms } from './routeDrawing';

const map: MapView = {
  rooms: [[0,0], [1,0], [1,1], [2,1], [3,1]].map(([x,y], id) => ({ id, x:x!, y:y!, type:'empty', visited:true, cleared:true, free:true, back:null })),
  doors: [[0,1], [1,2], [2,3], [3,4]].map(([a,b]) => ({ a:a!, b:b!, kind:'open', passable:true, key:false })),
};

describe('Route ink and confirmed walks', () => {
  it('draws a bent Route without crossing any Room glyph', () => {
    const ink = routeInk(map, 0, [1,2,3,4]);
    expect(ink.length).toBeGreaterThan(5);
    for (let i=1;i<ink.length;i++) {
      const a=ink[i-1]!, b=ink[i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
      for(let step=0;step<=20;step++) {
        const p={x:a.x+(b.x-a.x)*step/20,y:a.y+(b.y-a.y)*step/20};
        for(const room of map.rooms) {
          const c=center(room);
          expect(Math.abs(p.x-c.x)<19 && Math.abs(p.y-c.y)<19).toBe(false);
        }
      }
    }
  });
  it('does not draw a shortcut through missing Rooms or missing Doors', () => {
    expect(routeInk(map,0,[4])).toEqual([]);
    expect(routeInk(map,0,[1,99])).toEqual([]);
  });
  it('cuts the old Route at the response Room, keeping its bends', () => {
    expect(walkedRooms(map,map,0,3,[1,2,3,4]).map(r=>r.id)).toEqual([0,1,2,3]);
    expect(walkedRooms(map,map,0,4,[1,2,3,4]).map(r=>r.id)).toEqual([0,1,2,3,4]);
  });
  it('uses a single known Door for a normal step and fades a Portal', () => {
    expect(walkedRooms(map,map,0,1).map(r=>r.id)).toEqual([0,1]);
    expect(walkedRooms(map,map,0,4)).toEqual([]);
    expect(walkedRooms(map,map,0,0,[1,2])).toEqual([]);
  });
});
