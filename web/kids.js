import { encodeTiles, decodeRack } from './tiles.js?v=131'

const HARD = /[JKÑQWXYZ]/

const FR = `
AMI ANE ARC BAL BAR BEC BLE BOL BON BUS BUT CAP CAR CAS COL COR COU CRI DES DOS
EAU FER FEU FIL FIN FOU GEL ILE LAC LIT LOT LUI MAL MER MUR NEZ NID NOM OIE OUI
PAS PIC PIN POT RAI RAT RIZ RUE SAC SEL SOL SON SUD TOC TON TUB VAN VIN VIS VUE
AILE AIME AIRE AMIE ANSE ARME AUTO BAIE BAIN BASE BEAU BISE BLEU BOIS BORD BOUE
BOUT BRIN BRUN CAFE CAGE CAMP CANE CAPE CASE CHAT CHER CIEL CIRE CLOS CLOU COIN
COTE CUBE DAME DENT DIRE DOUX DUNE FACE FAIM FAIT FAUX FILE FILS FORT FOUR GANT
GARE GRIS GROS LAIT LAME LION LIRE LOIN LOUP LUNE MAIN MERE MIDI MINE MOTO MURS
NAGE NOIR NOTE NUIT OGRE ONDE OURS PAGE PAIN PAIR PARC PART PAVE PEAU PERE PEUR
PILE PIRE PLAT PLUS POIL POIS PONT PORT POUR PRIS RAME RANG RIRE ROBE ROSE ROUE
SALE SANG SAUT SEAU SOIF SOIN SOIR TAPE TARD TIRE TOIT TOUR TOUT TRES TROU TUBE
VASE VENT VERS VERT VEAU VIDE VITE VOIE VOIR VOLE
ARBRE AVION BALLE BANDE BARBE BLANC BLEUE BOITE BOULE BRAVE BRUIT BULLE CADRE
CALME CANNE CARTE CHAMP CHANT CHAUD CHIEN CHOSE CLAIR COEUR CORDE COUDE DANSE
DINER DOIGT ECOLE FABLE FEMME FERME FILLE FLEUR FORET FRUIT GARDE GLACE GRAIN
GRAND HUILE IMAGE LIVRE MAGIE MERCI METRE MICRO MONDE NUAGE ONGLE OCEAN PAIRE
PANNE PASSE PATTE PERLE PETIT PHOTO PIANO PIECE PISTE PLAGE PLUIE POCHE POIRE
POMME PORTE POULE PRUNE RADIO REINE REPAS ROBES ROUGE ROULE ROUTE SALLE SAUCE
SINGE SOUPE SPORT TABLE TAPIS TERRE TIGRE TOILE TRAIN USINE VACHE VAGUE VERRE
VILLE VISAGE VOILE
`.trim().split(/\s+/).filter((w) => w.length >= 3 && w.length <= 5 && !HARD.test(w))

const EN = `
ANT APE ARM ART BAG BAT BED BEE BIG BUG BUS CAP CAR CUP DAD DIG DOT EAR EAT EGG
FAN FAT FIG FIN FUN GAS GEM GUM HEN HID HIP HIT HOT HUG LID LIP LOG LOT MAN MAP
MAT MEN MUD MUG NAP NET NUT PAD PAN PAT PEA PEN PET PIG PIN PIP PIT POD POP POT PUP
RAG RAM RAT RED RIB RIP ROD RUG RUN SAD SEA SET SIP SIT SUN TAB TAG TAP TEA TEN
TIN TIP TOE TOP TUB VAN
BALL BAND BARN BATH BEAD BEAM BEAN BEAR BEAT BELL BELT BEND BEST BIRD BITE BLUE
BOAT BONE BOOK BOOT CAMP CARD CARE CART CAKE CASE CAST COAT COIN COLD COME COOK
COOL CORN CUBE DARK DATE DEAR DEER DESK DIME DIRT DISH DOLL DOOR DRUM FACE FAIR
FALL FARM FAST FEAR FEED FEEL FEET FILE FIND FINE FIRE FISH FLAT FOOD FOOT FORT
FROG FULL GAME GATE GIFT GIRL GOAT GOLD GOOD GRIN HAIR HAND HARD HEAD HEAP HEAR
HEAT HELP HIDE HILL HOME HOPE HOUR LAMP LAND LANE LAST LATE LEAF LEFT LIFT LIKE
LINE LION LIST LONG LOVE MADE MAIL MAIN MAKE MALE MALL MEAL MEAN MEAT MILE MILK
MIND MINE MOON MORE MOST MOVE MUST NAME NEAR NEED NEST NICE NINE NOSE NOTE OPEN
PAGE PAIN PAIR PALE PARK PART PASS PAST PATH PEAR PILE PINE PLAN PLOT PLUS POND
POOL PORT POST RACE RAIN READ REAL REST RICE RIDE RING ROAD ROCK ROLE ROOF ROOM
ROPE ROSE RULE SAFE SAID SAIL SALE SALT SAME SAND SAVE SEAL SEAT SEED SEEM SELF
SEND SHIP SHOE SHOP SIDE SING SINK SOAP SOFT SOIL SOME SONG SOON SOUP STAR STEP
STOP TALE TAPE TEAM TEAR TELL TENT TEST THAN THAT THEM THEN THIS TIDE TIME TIRE
TOLD TONE TOOL TOUR TREE TRIM TRIP TUBE TUNE TURN UNDO UNIT USED VASE VEST VOTE
APPLE BEACH BREAD BRICK BRUSH CHAIR CHEST CHILD CLOUD DANCE DREAM DRESS DRINK
EARTH FIELD FLOOD FLOOR FRUIT GLASS GRAPE GRASS GREEN HAPPY HEART HORSE HOUSE
LIGHT LUNCH MAGIC MONTH MOUSE MUSIC NIGHT NORTH OCEAN PAINT PAPER PARTY PEACH
PIANO PLANT PLATE RADIO RIVER ROBIN ROUND SHEEP SHELL SHIRT SHOES SMILE SNAIL
SPACE SPOON STARS STONE STORM STORY SUGAR TABLE TEETH TIGER TOAST TRAIN TREES
TRUCK UNCLE UNDER
`.trim().split(/\s+/).filter((w) => /^[A-Z]+$/.test(w) && w.length >= 3 && w.length <= 5 && !HARD.test(w))

const FR_LONG = `
CHEVAUX CHEVAL MAISON ECOLE BANANE TOMATE FLEURS CADEAU BONBON BATEAU
AVIONS SOLEIL GATEAU OISEAU ANIMAUX VOITURE FENETRE CAHIER POMMES
FROMAGE CAROTTE LAPINS CHIENS CADEAUX BATEAUX MAISONS BONBONS TOMATES
BANANES OISEAUX GATEAUX CHAUVE CUISINE SALADE FRAISE CERISE MOUTON
POULET CANARD ARBRE
`.trim().split(/\s+/).filter((w) => /^[A-Z]{6,7}$/.test(w))

const EN_LONG = `
HORSES ANIMALS FLOWERS BANANA TOMATO SCHOOL HOUSES GARDEN PLANET FRIEND
FAMILY TURTLE RABBIT CHICKEN PUPPIES ORANGE PURPLE BUTTON PENCIL CASTLE
DRAGON FOREST ISLAND MOTHER FATHER SISTER BROTHER WINDOW SUMMER WINTER
SPRING AUTUMN FLOWER GARDEN TURTLE
`.trim().split(/\s+/).filter((w) => /^[A-Z]{6,7}$/.test(w))

const ES = `
ALA AÑO AVE BAR BUS CAL COL DAR DOS ECO ERA FIN GAS GOL LAGO LUZ MAL MAR MES MIEL
NIÑA NIÑO OLA ORO OSO PAN PAZ PEZ PIE RIO SAL SOL SUR TE VEO VOZ
AGUA AIRE ALMA AMOR ARCO AUTO AZUL BESO BOLA BOTE CAMA CASA CENA CINE COLA DADO
DIA FLOR FUEGO GATO HORA JUEGO LAGO LECHE LIBRO LUNA MANO MESA MIEL MONO MOTO
NUBE OJO OLA ORO PATO PELO PERA PIE PISO PLAYA QUESO RANA RISA ROJO ROSA RUTA
SILLA SOL TAZA TREN VACA VELA VIDA
AMIGO ARBOL AVION BARCO BEBE CAMPO CARA CARTA CIELO COCHE COLOR DULCE FRESA FRUTA
GLOBO HUEVO ISLA LAGO LAPIZ LEON LLAVE MADRE MAPA MAR NARIZ NOCHE PADRE PAPEL
PARQUE PERRO PLAYA PUERTA RADIO RATON RELOJ ROJO RUEDA SALTO SOPA TIERRA TIGRE
VASO VERDE ZUMO
`.trim().split(/\s+/).filter((w) => /^[A-ZÑ]+$/.test(w) && w.length >= 3 && w.length <= 5 && !HARD.test(w))

const ES_LONG = `
ABUELOS AMIGOS ANIMALES BANANA CABALLO CAMION COCINA COLEGIO CONEJO CUADERNO
ESCUELA FAMILIA FLORES GALLETA JARDIN MAESTRO MANZANA NARANJA OVEJAS PAJARO
PALABRA PELOTA PERROS PLANETA PLATANO REGALO TOMATE TORTUGA VENTANA VERANO
`.trim().split(/\s+/).filter((w) => /^[A-ZÑ]{6,8}$/.test(w))

const LISTS = {
  fr: [...new Set([...FR, ...FR_LONG])],
  en: [...new Set([...EN, ...EN_LONG])],
  es: [...new Set([...ES, ...ES_LONG])],
}
const LONG = {
  fr: [...new Set(FR_LONG)],
  en: [...new Set(EN_LONG)],
  es: [...new Set(ES_LONG)],
}

function language(lang) {
  return lang === 'en' || lang === 'es' ? lang : 'fr'
}

function rackCounts(rack) {
  const counts = Object.create(null)
  for (const ch of rack) {
    if (ch !== '?' && ch !== '.' && ch !== '*') counts[ch] = (counts[ch] || 0) + 1
  }
  return counts
}

function formable(word, counts) {
  const used = Object.create(null)
  for (const ch of word) {
    used[ch] = (used[ch] || 0) + 1
    if (used[ch] > (counts[ch] || 0)) return false
  }
  return true
}

export function kidsWords(lang = 'fr') {
  return LISTS[language(lang)]
}

export function kidsLong(lang = 'fr') {
  return LONG[language(lang)]
}

// Beginner words tile-encoded per language and Spanish edition (LLAVE and
// CABALLO are 5 tiles, PERRO is 4 — see tiles.js).
const encodedCache = new Map()
function encodedWords(lang, edition) {
  const key = `${lang}|${edition}`
  let list = encodedCache.get(key)
  if (!list) {
    list = kidsWords(lang).map((word) => ({ word, enc: encodeTiles(word, lang, edition) }))
    encodedCache.set(key, list)
  }
  return list
}

export function kidsAnagrams(rack, lang = 'fr', edition = 'fise') {
  const encRack = encodeTiles(String(rack || '').toUpperCase(), language(lang), edition)
  const counts = rackCounts(encRack)
  const tiles = encRack.replace(/[?.*]/g, '').length
  const groups = []
  for (let len = Math.min(8, tiles); len >= 3; len--) {
    const found = []
    for (const { word, enc } of encodedWords(language(lang), edition)) {
      if (enc.length !== len) continue
      if (!formable(enc, counts)) continue
      found.push({ word, score: enc.length, jokers: [] })
    }
    found.sort((a, b) => a.word.localeCompare(b.word))
    if (found.length) groups.push({ len, words: found })
  }
  return groups
}

function shuffleWord(word, rnd) {
  const a = [...word]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.join('')
}

export function dealKids(lang = 'fr', rnd = Math.random, excludeSeed = '', edition = 'fise') {
  const fullPool = kidsLong(lang)
  const blocked = String(excludeSeed || '').toUpperCase()
  const filtered = fullPool.filter((word) => word !== blocked)
  const pool = filtered.length ? filtered : fullPool
  const fallback = lang === 'en' ? 'HORSES' : lang === 'es' ? 'CABALLO' : 'CHEVAUX'
  // Shuffle tiles, not characters: LLAVE shuffles as LL·A·V·E.
  const shuffleTiles = (seed) =>
    decodeRack(shuffleWord(encodeTiles(seed, language(lang), edition), rnd), language(lang), edition)
  for (let attempt = 0; attempt < 40; attempt++) {
    const seed = pool[Math.floor(rnd() * pool.length)] || fallback
    const rack = shuffleTiles(seed)
    const groups = kidsAnagrams(rack, lang, edition)
    const words = groups.flatMap((g) => g.words.map((w) => w.word))
    if (!words.includes(seed)) continue
    return { category: 'kids', rack, groups, seed }
  }
  const seed = pool[0] || fallback
  const rack = shuffleTiles(seed)
  return { category: 'kids', rack, groups: kidsAnagrams(rack, lang, edition), seed }
}
