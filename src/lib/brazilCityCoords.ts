/**
 * Pre-built lat/lng lookup for Brazilian cities.
 * Key: "CIDADE|UF" (uppercase, normalized).
 * Covers all state capitals + ~100 major cities where stores are typically located.
 */

type Coords = [number, number]; // [lng, lat]

const RAW: [string, string, Coords][] = [
  // ── Capitais ──────────────────────────────────────────────────────────────
  ['SAO PAULO',        'SP', [-46.6333, -23.5505]],
  ['RIO DE JANEIRO',   'RJ', [-43.1729, -22.9068]],
  ['BELO HORIZONTE',   'MG', [-43.9378, -19.9191]],
  ['SALVADOR',         'BA', [-38.5108, -12.9714]],
  ['FORTALEZA',        'CE', [-38.5434, -3.7172]],
  ['CURITIBA',         'PR', [-49.2731, -25.4284]],
  ['MANAUS',           'AM', [-60.0217, -3.1019]],
  ['RECIFE',           'PE', [-34.8811, -8.0539]],
  ['PORTO ALEGRE',     'RS', [-51.2177, -30.0346]],
  ['BELEM',            'PA', [-48.5044, -1.4558]],
  ['GOIANIA',          'GO', [-49.2539, -16.6864]],
  ['FLORIANOPOLIS',    'SC', [-48.5482, -27.5954]],
  ['SAO LUIS',         'MA', [-44.3068, -2.5307]],
  ['MACEIO',           'AL', [-35.7353, -9.6498]],
  ['NATAL',            'RN', [-35.2094, -5.7945]],
  ['TERESINA',         'PI', [-42.8016, -5.0919]],
  ['CAMPO GRANDE',     'MS', [-54.6464, -20.4697]],
  ['JOAO PESSOA',      'PB', [-34.8641, -7.1195]],
  ['ARACAJU',          'SE', [-37.0731, -10.9472]],
  ['PORTO VELHO',      'RO', [-63.9004, -8.7612]],
  ['MACAPA',           'AP', [-51.0669, 0.0355]],
  ['CUIABA',           'MT', [-56.0975, -15.5961]],
  ['RIO BRANCO',       'AC', [-67.8090, -9.9754]],
  ['BOA VISTA',        'RR', [-60.6733, 2.8235]],
  ['PALMAS',           'TO', [-48.3336, -10.2428]],
  ['VITORIA',          'ES', [-40.3377, -20.3155]],
  ['BRASILIA',         'DF', [-47.9292, -15.7801]],
  // ── SP interior & grande SP ───────────────────────────────────────────────
  ['CAMPINAS',         'SP', [-47.0626, -22.9056]],
  ['GUARULHOS',        'SP', [-46.5332, -23.4543]],
  ['SAO BERNARDO DO CAMPO', 'SP', [-46.5650, -23.6939]],
  ['SANTO ANDRE',      'SP', [-46.5320, -23.6639]],
  ['OSASCO',           'SP', [-46.7919, -23.5328]],
  ['RIBEIRAO PRETO',   'SP', [-47.8103, -21.1775]],
  ['SAO JOSE DOS CAMPOS', 'SP', [-45.8872, -23.1794]],
  ['SOROCABA',         'SP', [-47.4526, -23.5015]],
  ['SANTOS',           'SP', [-46.3336, -23.9608]],
  ['MOGI DAS CRUZES',  'SP', [-46.1875, -23.5231]],
  ['DIADEMA',          'SP', [-46.6208, -23.6861]],
  ['JUNDIAI',          'SP', [-46.8842, -23.1864]],
  ['PIRACICABA',       'SP', [-47.6476, -22.7253]],
  ['BAURU',            'SP', [-49.0608, -22.3246]],
  ['SAO JOSE DO RIO PRETO', 'SP', [-49.3801, -20.8113]],
  ['LIMEIRA',          'SP', [-47.4017, -22.5647]],
  ['FRANCA',           'SP', [-47.4008, -20.5386]],
  ['PRAIA GRANDE',     'SP', [-46.4083, -24.0058]],
  ['CARAPICUIBA',      'SP', [-46.8358, -23.5228]],
  ['MARILIA',          'SP', [-49.9458, -22.2139]],
  ['PRESIDENTE PRUDENTE', 'SP', [-51.3925, -22.1256]],
  ['COTIA',            'SP', [-46.9192, -23.6037]],
  ['ARAÇATUBA',        'SP', [-50.4319, -21.2092]],
  ['TAUBATE',          'SP', [-45.5553, -23.0262]],
  ['BARUERI',          'SP', [-46.8761, -23.5114]],
  // ── RJ ────────────────────────────────────────────────────────────────────
  ['NITEROI',          'RJ', [-43.1043, -22.8833]],
  ['SAO GONCALO',      'RJ', [-43.0592, -22.8268]],
  ['DUQUE DE CAXIAS',  'RJ', [-43.3114, -22.7858]],
  ['NOVA IGUACU',      'RJ', [-43.4458, -22.7592]],
  ['CAMPOS DOS GOYTACAZES', 'RJ', [-41.3244, -21.7611]],
  ['PETROPOLIS',       'RJ', [-43.1789, -22.5053]],
  ['VOLTA REDONDA',    'RJ', [-44.0964, -22.5231]],
  ['MACAE',            'RJ', [-41.7869, -22.3711]],
  ['BARRA MANSA',      'RJ', [-44.1717, -22.5444]],
  ['ANGRA DOS REIS',   'RJ', [-44.3183, -22.9669]],
  // ── MG ────────────────────────────────────────────────────────────────────
  ['UBERLANDIA',       'MG', [-48.2772, -18.9186]],
  ['CONTAGEM',         'MG', [-44.0536, -19.9322]],
  ['JUIZ DE FORA',     'MG', [-43.3481, -21.7642]],
  ['BETIM',            'MG', [-44.1983, -19.9681]],
  ['MONTES CLAROS',    'MG', [-43.8611, -16.7353]],
  ['RIBEIRAO DAS NEVES', 'MG', [-44.0878, -19.7606]],
  ['UBERABA',          'MG', [-47.9319, -19.7478]],
  ['GOVERNADOR VALADARES', 'MG', [-41.9494, -18.8512]],
  ['IPATINGA',         'MG', [-42.5378, -19.4711]],
  ['SETE LAGOAS',      'MG', [-44.2467, -19.4606]],
  // ── BA ────────────────────────────────────────────────────────────────────
  ['FEIRA DE SANTANA', 'BA', [-38.9661, -12.2664]],
  ['VITORIA DA CONQUISTA', 'BA', [-40.8394, -14.8661]],
  ['CAMACARI',         'BA', [-38.3244, -12.6994]],
  ['ILHEUS',           'BA', [-39.0489, -14.7931]],
  ['JUAZEIRO',         'BA', [-40.5019, -9.4319]],
  ['ITABUNA',          'BA', [-39.2803, -14.7858]],
  // ── PR ────────────────────────────────────────────────────────────────────
  ['LONDRINA',         'PR', [-51.1644, -23.3045]],
  ['MARINGA',          'PR', [-51.9378, -23.4253]],
  ['FOZDO IGUACU',     'PR', [-54.5761, -25.5478]],
  ['FOZ DO IGUACU',    'PR', [-54.5761, -25.5478]],
  ['CASCAVEL',         'PR', [-53.4597, -24.9558]],
  ['SAO JOSE DOS PINHAIS', 'PR', [-49.2075, -25.5311]],
  ['COLOMBO',          'PR', [-49.2244, -25.2939]],
  ['GUARAPUAVA',       'PR', [-51.4608, -25.3928]],
  ['PONTA GROSSA',     'PR', [-50.1589, -25.0942]],
  ['PARANAGUA',        'PR', [-48.5089, -25.5197]],
  // ── RS ────────────────────────────────────────────────────────────────────
  ['CANOAS',           'RS', [-51.1828, -29.9178]],
  ['CAXIAS DO SUL',    'RS', [-51.1797, -29.1681]],
  ['PELOTAS',          'RS', [-52.3422, -31.7716]],
  ['SANTA MARIA',      'RS', [-53.8069, -29.6842]],
  ['GRAVATAÍ',         'RS', [-50.9914, -29.9444]],
  ['NOVO HAMBURGO',    'RS', [-51.1306, -29.6783]],
  ['SAO LEOPOLDO',     'RS', [-51.1483, -29.7642]],
  ['VIAMAO',           'RS', [-51.0228, -30.0808]],
  // ── SC ────────────────────────────────────────────────────────────────────
  ['JOINVILLE',        'SC', [-48.8458, -26.3044]],
  ['BLUMENAU',         'SC', [-49.0661, -26.9189]],
  ['SAO JOSE',         'SC', [-48.6394, -27.5939]],
  ['CHAPECO',          'SC', [-52.6150, -27.0939]],
  ['CRICIUMA',         'SC', [-49.3697, -28.6769]],
  ['ITAJAI',           'SC', [-48.6644, -26.9078]],
  // ── GO ────────────────────────────────────────────────────────────────────
  ['APARECIDA DE GOIANIA', 'GO', [-49.2439, -16.8236]],
  ['ANAPOLIS',         'GO', [-48.9528, -16.3269]],
  ['RIO VERDE',        'GO', [-50.9278, -17.7978]],
  // ── CE ────────────────────────────────────────────────────────────────────
  ['CAUCAIA',          'CE', [-38.6531, -3.7358]],
  ['JUAZEIRO DO NORTE', 'CE', [-39.3183, -7.2139]],
  ['SOBRAL',           'CE', [-40.3497, -3.6886]],
  // ── PE ────────────────────────────────────────────────────────────────────
  ['CARUARU',          'PE', [-36.0053, -8.2844]],
  ['OLINDA',           'PE', [-34.8589, -8.0175]],
  ['JABOATAO DOS GUARARAPES', 'PE', [-35.0044, -8.1131]],
  ['PETROLINA',        'PE', [-40.5019, -9.3989]],
  ['PAULISTA',         'PE', [-34.8722, -7.9406]],
  // ── MA ────────────────────────────────────────────────────────────────────
  ['IMPERATRIZ',       'MA', [-47.4922, -5.5261]],
  ['TIMON',            'MA', [-42.8350, -5.0942]],
  // ── PA ────────────────────────────────────────────────────────────────────
  ['ANANINDEUA',       'PA', [-48.3722, -1.3653]],
  ['SANTAREM',         'PA', [-54.7081, -2.4392]],
  ['MARABA',           'PA', [-49.1178, -5.3689]],
  // ── ES ────────────────────────────────────────────────────────────────────
  ['VILA VELHA',       'ES', [-40.2925, -20.3297]],
  ['SERRA',            'ES', [-40.3083, -20.1283]],
  ['CARIACICA',        'ES', [-40.4139, -20.2633]],
  // ── MT ────────────────────────────────────────────────────────────────────
  ['VARZEA GRANDE',    'MT', [-56.1331, -15.6461]],
  ['RONDONOPOLIS',     'MT', [-54.6378, -16.4728]],
  // ── MS ────────────────────────────────────────────────────────────────────
  ['DOURADOS',         'MS', [-54.8122, -22.2211]],
  ['TRES LAGOAS',      'MS', [-51.7028, -20.7519]],
  // ── AL ────────────────────────────────────────────────────────────────────
  ['ARAPIRACA',        'AL', [-36.6608, -9.7525]],
  // ── RN ────────────────────────────────────────────────────────────────────
  ['MOSSORO',          'RN', [-37.3442, -5.1878]],
  ['CAICÓ',            'RN', [-37.0992, -6.4583]],
  // ── PI ────────────────────────────────────────────────────────────────────
  ['PARNAIBA',         'PI', [-41.7764, -2.9067]],
];

// State center fallbacks (used when city not found)
const STATE_CENTERS: Record<string, Coords> = {
  AC: [-70.5119, -9.0238], AL: [-36.9541, -9.5713], AM: [-64.9912, -3.4168],
  AP: [-51.7666, 1.4102],  BA: [-41.7007, -12.5797], CE: [-39.6062, -5.4984],
  DF: [-47.9292, -15.7801], ES: [-40.5036, -19.5832], GO: [-49.6188, -15.9271],
  MA: [-44.9823, -5.4203], MG: [-44.6987, -18.5122], MS: [-54.5208, -20.7722],
  MT: [-55.9166, -12.6819], PA: [-53.0753, -3.4168],  PB: [-36.7820, -7.2399],
  PE: [-37.9792, -8.8137], PI: [-42.9687, -7.7183],  PR: [-51.6166, -24.8892],
  RJ: [-43.1729, -22.9068], RN: [-36.5277, -5.8137], RO: [-62.8029, -10.9612],
  RR: [-61.3667, 1.9899],  RS: [-53.0968, -30.0346], SC: [-50.4983, -27.5954],
  SE: [-37.4500, -10.5741], SP: [-48.5480, -22.2133], TO: [-48.3280, -10.1753],
};

const LOOKUP = new Map<string, Coords>();
for (const [city, uf, coords] of RAW) {
  LOOKUP.set(`${city}|${uf}`, coords);
}

function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Returns [lng, lat] for a city+UF.
 * Falls back to the state center if the city isn't in the table.
 */
export function getCityCoords(cidade: string, uf: string): Coords | null {
  const key = `${normalize(cidade)}|${normalize(uf)}`;
  if (LOOKUP.has(key)) return LOOKUP.get(key)!;
  // Try partial match: city name starts with
  const prefix = normalize(cidade);
  for (const [k, v] of LOOKUP) {
    if (k.startsWith(prefix + '|' + normalize(uf))) return v;
  }
  return STATE_CENTERS[normalize(uf)] ?? null;
}

/**
 * Lista completa das cidades conhecidas (para autocomplete).
 */
export function listKnownCities(): { cidade: string; uf: string; lat: number; lng: number }[] {
  return RAW.map(([cidade, uf, [lng, lat]]) => ({ cidade, uf, lat, lng }));
}

/**
 * Distância em km entre dois pontos (fórmula de Haversine).
 */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // raio da Terra em km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
