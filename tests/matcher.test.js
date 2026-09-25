// Tests for src/aisles.js (spec at the top of that file). Run: tests/run.sh
// PROTECTED: don't change this file to make code pass; change the code.
load('src/aisles.js');

var pass = 0, fail = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else { fail++; print('FAIL ' + name + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
}

var A = ListoAisles;
var DICT = {
  FRU: ['aguacate', 'jitomate', 'chile', 'chile poblano', 'champiñón', 'manzana', 'uva', 'apio',
        'cebolla', 'limón', 'lechuga', 'papa'],
  PAN: ['pan', 'tortilla', 'pastel', 'pastel tres leches', 'tres leches', 'bolillo'],
  CAR: ['jamón', 'jamón de pavo', 'carnitas', 'pollo', 'res', 'pechuga'],
  LAC: ['leche', 'huevo', 'crema', 'mantequilla', 'yogurt', 'leche de almendra'],
  CON: ['helado', 'hielo', 'verduras congeladas', 'croquetas de pollo'],
  DES: ['sal', 'harina', 'vinagre', 'atún', 'mantequilla de maní', 'pan molido', 'ajonjolí',
        'chiles en vinagre', 'tapioca', 'nuez'],
  BOT: ['cocada', 'papas fritas'],
  BEB: ['agua', 'jugo', 'coca cola', 'cerveza', 'té'],
  LIM: ['detergente', 'sartén', 'tapete', 'papel de baño'],
  HIG: ['crema para manos', 'jabón corporal'],
  FAR: ['sal de uvas', 'paracetamol'],
  BBE: ['pañales'],
  MAS: ['croquetas', 'croquetas para perro']
};

function has(name) { return typeof A[name] === 'function'; }
if (!has('fold') || !has('stripQuantity') || !has('buildIndex') || !has('aisleOf')) {
  throw new Error('ListoAisles must define fold, stripQuantity, buildIndex and aisleOf');
}

// fold
eq('fold accents', A.fold('Champiñón  JAMÓN'), 'champinon jamon');
eq('fold punctuation', A.fold('Coca-Cola, 3 litros!'), 'coca cola 3 litros');
eq('fold keeps slash', A.fold('1/2 docena'), '1/2 docena');
eq('fold decimal comma', A.fold('1,5 kg'), '1.5 kg');
eq('fold sentence dot', A.fold('ajo.'), 'ajo');

// stripQuantity
eq('qty kg de', A.stripQuantity('2 kg de tortillas'), 'tortillas');
eq('qty fraction', A.stripQuantity('1/2 docena de huevos'), 'huevos');
eq('qty words+unit', A.stripQuantity('medio kilo de jamon de pavo'), 'jamon de pavo');
eq('qty trailing', A.stripQuantity('coca cola 3 litros'), 'coca cola');
eq('qty digit noun', A.stripQuantity('3 leches'), 'leches');
eq('qty number word stays', A.stripQuantity('tres leches'), 'tres leches');
eq('qty trailing digit', A.stripQuantity('panales etapa 3'), 'panales etapa');
eq('qty decimal', A.stripQuantity('1.5 kg de pollo'), 'pollo');
eq('qty none', A.stripQuantity('jugo de manzana'), 'jugo de manzana');

var idx = A.buildIndex(DICT);
function id(t, ov) { return A.aisleOf(t, idx, ov).id; }

// exact, folding, whole words
eq('exact', id('aguacate'), 'FRU');
eq('accents', id('Champiñón'), 'FRU');
eq('no substring pan', id('pantuflas'), 'OTR');
eq('no substring te', id('tenis'), 'OTR');
eq('no substring res', id('flores'), 'OTR');
eq('te word', id('té verde'), 'BEB');
eq('empty', id('   '), 'OTR');

// plurals
eq('plural s', id('aguacates'), 'FRU');
eq('plural es', id('limones'), 'FRU');
eq('plural chiles', id('chiles'), 'FRU');
eq('plural ces', id('nueces'), 'DES');
eq('plural jitomates', id('jitomates'), 'FRU');

// longest phrase, then leftmost
eq('phrase beats word', id('chiles en vinagre'), 'DES');
eq('phrase with plurals', id('chiles poblanos'), 'FRU');
eq('phrase mani', id('mantequilla de maní'), 'DES');
eq('phrase almendra', id('leche de almendra'), 'LAC');
eq('phrase croquetas pollo', id('croquetas de pollo'), 'CON');
eq('phrase croquetas perro', id('croquetas para perro'), 'MAS');
eq('phrase sal de uvas', id('sal de uvas'), 'FAR');
eq('phrase pastel', id('pastel tres leches'), 'PAN');
eq('phrase tres leches', id('tres leches'), 'PAN');
eq('phrase pan molido', id('pan molido'), 'DES');
eq('phrase papel de bano', id('papel de baño'), 'LIM');
eq('phrase crema para manos', id('crema para manos'), 'HIG');
eq('leftmost jugo', id('jugo de manzana'), 'BEB');
eq('leftmost vinagre', id('vinagre de manzana'), 'DES');
eq('leftmost tortillas', id('tortillas de harina'), 'PAN');
eq('verduras congeladas', id('verduras congeladas'), 'CON');
eq('bolsa de hielo', id('bolsa de hielo'), 'CON');

// quantities inside aisleOf
eq('aisle 2 kg tortillas', id('2 kg de tortillas'), 'PAN');
eq('aisle 1/2 docena', id('1/2 docena de huevos'), 'LAC');
eq('aisle medio kilo', id('medio kilo de jamón de pavo'), 'CAR');
eq('aisle coca 3 litros', id('Coca Cola 3 litros'), 'BEB');
eq('aisle 3 leches', id('3 leches'), 'LAC');
eq('aisle panales etapa', id('pañales etapa 3'), 'BBE');

// typo fallback
var r1 = A.aisleOf('aguacte', idx);
eq('typo aguacte', [r1.id, r1.guess], ['FRU', true]);
var r2 = A.aisleOf('detergnte', idx);
eq('typo detergnte', [r2.id, r2.guess], ['LIM', true]);
var r3 = A.aisleOf('yogurth', idx);
eq('typo yogurth', [r3.id, r3.guess], ['LAC', true]);
eq('typo too short', id('ajp'), 'OTR');
eq('typo ambiguous', id('mechuga'), 'OTR');
var r4 = A.aisleOf('aguacate', idx);
eq('exact is not a guess', [r4.id, r4.guess, r4.term], ['FRU', false, 'aguacate']);

// overrides
eq('override wins', id('pan molido', { 'pan molido': 'PAN' }), 'PAN');
eq('override uses stripped key', id('2 kg de pan molido', { 'pan molido': 'PAN' }), 'PAN');
eq('override other items unaffected', id('aguacate', { 'pan molido': 'PAN' }), 'FRU');

// aisles list
eq('aisles order', (A.AISLES || []).map(function (a) { return a.id; }).join(' '),
   'FRU PAN CAR LAC CON DES BOT BEB LIM HIG FAR BBE MAS OTR');

print(pass + ' passed, ' + fail + ' failed');
if (fail > 0) throw new Error(fail + ' test(s) failed');
