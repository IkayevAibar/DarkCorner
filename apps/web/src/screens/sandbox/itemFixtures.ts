import type { ItemView } from '@dark/shared';
import { REVEALS, sealed } from './lootFixtures';

const sword: ItemView = {
  ...REVEALS.rare, id:'item-common', tier:'common', base:'longsword', icon:'sword', art:'/art/gear/longsword.webp',
  name:{en:'Longsword',ru:'Длинный меч'}, quality:42, bonusStats:[], bonusStatIds:[], worth:28,
  gear:{slot:'main',group:'martial',classes:['fighter','paladin','barbarian'],damage:{dice:1,sides:8,min:1,max:8,percent:100,hits:'slash'},armor:null,heavy:false,hands:1,light:false},
};
export const ITEM_FIXTURES = {
  common:sword,
  uncommon:{...sword,id:'item-uncommon',tier:'uncommon',base:'dagger',icon:'dagger',art:'/art/gear/dagger.webp',
    name:{en:'Dagger of the Watch',ru:'Кинжал дозора'},quality:68,upgrade:2,bonusStats:[{en:'+2 Dexterity',ru:'+2 к ловкости'}],bonusStatIds:['dex'],
    gear:{...sword.gear!,group:'simple',classes:null,damage:{dice:1,sides:4,min:1,max:5,percent:120,hits:'pierce'},light:true}},
  rare:REVEALS.rare,
  epic:{...sword,id:'item-epic',tier:'epic',base:'breastplate',icon:'armor',art:'/art/gear/breastplate.webp',
    name:{en:'Breastplate of Endurance',ru:'Кираса стойкости'},quality:87,worth:780,bonusStats:[{en:'+3 Constitution',ru:'+3 к телосложению'},{en:'+12 Maximum health',ru:'+12 к максимуму здоровья'}],bonusStatIds:['con','maxHp'],
    gear:{slot:'body',group:'medium',classes:['fighter','cleric','barbarian','ranger','paladin'],damage:null,armor:{ac:15,body:true,maxDex:2},heavy:false,hands:1,light:false}},
  legendary:{...REVEALS.radiant,id:'item-legendary',radiant:false},
  mythic:{...sword,id:'item-mythic',tier:'mythic',name:{en:'Wyrmfire',ru:'Пламя змея'},base:'staff',icon:'staff',art:'/art/items/wyrmfire.webp',quality:94,worth:12000,
    bonusStats:[{en:'+6 Intelligence',ru:'+6 к интеллекту'},{en:'+20% Spell power',ru:'+20% к силе заклинаний'}],bonusStatIds:['int','spellPower'],power:{en:'Dragon fire: a blaze that will not die.',ru:'Огонь дракона: пламя, которое не гаснет.'},
    gear:{...sword.gear!,group:'staff',classes:['wizard','cleric','warlock','druid','bard','sorcerer'],damage:{dice:1,sides:6,min:1,max:9,percent:150,hits:'bludgeon'}}},
  relic:REVEALS.relic,
  radiant:REVEALS.radiant,
  unidentified:{...sealed(REVEALS.radiant),id:'item-mystery',art:'/art/gear/orb.webp'},
  potion:{...sword,id:'item-potion',kind:'potion',base:'healing-potion',icon:'potion',art:'/art/gear/potion.webp',quantity:4,tier:'common',name:{en:'Healing potion',ru:'Лечебное зелье'},quality:null,bonusStats:null,bonusStatIds:null,power:null,radiant:null,gear:null,about:{en:'Restores health during a Run.',ru:'Восстанавливает здоровье во время вылазки.'},worth:8},
  bond:{...REVEALS.rare,id:'item-bond',base:'bond-ring',name:{en:'Bond ring',ru:'Кольцо уз'},art:null},
} satisfies Record<string,ItemView>;

