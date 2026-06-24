export type RegionData = { name: string; districts: string[] }

export const TANZANIA_REGIONS: RegionData[] = [
  {
    name: 'Dar es Salaam',
    districts: ['Ilala', 'Kinondoni', 'Temeke', 'Ubungo', 'Kigamboni'],
  },
  {
    name: 'Arusha',
    districts: ['Arusha Mjini', 'Arumeru', 'Karatu', 'Longido', 'Meru', 'Monduli', 'Ngorongoro'],
  },
  {
    name: 'Kilimanjaro',
    districts: ['Moshi Mjini', 'Moshi Vijijini', 'Hai', 'Rombo', 'Same', 'Siha', 'Mwanga'],
  },
  {
    name: 'Tanga',
    districts: ['Tanga Mjini', 'Muheza', 'Korogwe', 'Handeni', 'Kilindi', 'Lushoto', 'Mkinga', 'Pangani'],
  },
  {
    name: 'Morogoro',
    districts: ['Morogoro Mjini', 'Morogoro Vijijini', 'Kilosa', 'Kilombero', 'Ulanga', 'Mvomero', 'Gairo', 'Malinyi'],
  },
  {
    name: 'Pwani',
    districts: ['Bagamoyo', 'Kibaha Mjini', 'Kibaha Vijijini', 'Kisarawe', 'Mafia', 'Mkuranga', 'Rufiji'],
  },
  {
    name: 'Dodoma',
    districts: ['Dodoma Mjini', 'Bahi', 'Chamwino', 'Chemba', 'Kondoa', 'Kongwa', 'Mpwapwa'],
  },
  {
    name: 'Mwanza',
    districts: ['Nyamagana', 'Ilemela', 'Kwimba', 'Magu', 'Misungwi', 'Sengerema', 'Ukerewe'],
  },
  {
    name: 'Mara',
    districts: ['Musoma Mjini', 'Musoma Vijijini', 'Bunda', 'Butiama', 'Rorya', 'Serengeti', 'Tarime'],
  },
  {
    name: 'Kagera',
    districts: ['Bukoba Mjini', 'Bukoba Vijijini', 'Biharamulo', 'Karagwe', 'Kyerwa', 'Missenyi', 'Muleba', 'Ngara'],
  },
  {
    name: 'Shinyanga',
    districts: ['Shinyanga Mjini', 'Shinyanga Vijijini', 'Kahama Mjini', 'Kahama Vijijini', 'Kishapu', 'Msalala', 'Ushetu'],
  },
  {
    name: 'Tabora',
    districts: ['Tabora Mjini', 'Igunga', 'Kaliua', 'Nzega', 'Sikonge', 'Urambo', 'Uyui'],
  },
  {
    name: 'Kigoma',
    districts: ['Kigoma Mjini', 'Kigoma Vijijini', 'Buhigwe', 'Kakonko', 'Kasulu', 'Kibondo', 'Uvinza'],
  },
  {
    name: 'Rukwa',
    districts: ['Sumbawanga Mjini', 'Sumbawanga Vijijini', 'Kalambo', 'Nkasi'],
  },
  {
    name: 'Katavi',
    districts: ['Mpanda Mjini', 'Mpanda Vijijini', 'Mlele', 'Nsimbo'],
  },
  {
    name: 'Mbeya',
    districts: ['Mbeya Mjini', 'Mbeya Vijijini', 'Busokelo', 'Chunya', 'Kyela', 'Mbarali', 'Rungwe'],
  },
  {
    name: 'Songwe',
    districts: ['Momba', 'Msanda', 'Ileje', 'Mbozi', 'Songwe'],
  },
  {
    name: 'Iringa',
    districts: ['Iringa Mjini', 'Iringa Vijijini', 'Kilolo', 'Mafinga', 'Mufindi'],
  },
  {
    name: 'Njombe',
    districts: ['Njombe Mjini', 'Njombe Vijijini', 'Ludewa', 'Makambako', 'Makete', "Wanging'ombe"],
  },
  {
    name: 'Ruvuma',
    districts: ['Songea Mjini', 'Songea Vijijini', 'Mbinga', 'Namtumbo', 'Nyasa', 'Tunduru'],
  },
  {
    name: 'Lindi',
    districts: ['Lindi Mjini', 'Lindi Vijijini', 'Kilwa', 'Liwale', 'Nachingwea', 'Ruangwa'],
  },
  {
    name: 'Mtwara',
    districts: ['Mtwara Mjini', 'Mtwara Vijijini', 'Masasi Mjini', 'Masasi Vijijini', 'Nanyumbu', 'Newala', 'Tandahimba'],
  },
  {
    name: 'Singida',
    districts: ['Singida Mjini', 'Singida Vijijini', 'Ikungi', 'Iramba', 'Manyoni', 'Mkalama'],
  },
  {
    name: 'Geita',
    districts: ['Geita Mjini', 'Bukombe', 'Chato', 'Mbogwe', "Nyang'hwale"],
  },
  {
    name: 'Simiyu',
    districts: ['Bariadi Mjini', 'Bariadi Vijijini', 'Busega', 'Itilima', 'Maswa', 'Meatu'],
  },
  {
    name: 'Manyara',
    districts: ['Babati Mjini', 'Babati Vijijini', 'Hanang', 'Kiteto', 'Mbulu', 'Simanjiro'],
  },
  {
    name: 'Zanzibar Mjini Magharibi',
    districts: ['Mjini', 'Magharibi A', 'Magharibi B'],
  },
  {
    name: 'Zanzibar Kaskazini Unguja',
    districts: ['Kaskazini A', 'Kaskazini B'],
  },
  {
    name: 'Zanzibar Kusini Unguja',
    districts: ['Kati', 'Kusini'],
  },
  {
    name: 'Zanzibar Kaskazini Pemba',
    districts: ['Wete', 'Micheweni'],
  },
  {
    name: 'Zanzibar Kusini Pemba',
    districts: ['Chake Chake', 'Mkoani'],
  },
]

// Helpers
export const REGION_NAMES = TANZANIA_REGIONS.map(r => r.name)

// ── SEO slug helpers ──────────────────────────────────────
// Region name → URL slug, e.g. "Dar es Salaam" → "dar-es-salaam"
export function regionToSlug(region: string): string {
  return region.toLowerCase().replace(/\s+/g, '-')
}

// URL slug → region name, e.g. "dar-es-salaam" → "Dar es Salaam"
// Returns undefined if the slug doesn't map to a known region.
export function slugToRegion(slug: string): string | undefined {
  const normalized = slug.toLowerCase()
  return TANZANIA_REGIONS.find(r => regionToSlug(r.name) === normalized)?.name
}

export function getDistricts(regionName: string): string[] {
  return TANZANIA_REGIONS.find(r => r.name === regionName)?.districts ?? []
}

// Priority regions — zinaonyeshwa kwanza kwenye tabs
export const PRIORITY_REGIONS = [
  'Dar es Salaam',
  'Arusha',
  'Mwanza',
  'Dodoma',
  'Zanzibar Mjini Magharibi',
  'Kilimanjaro',
  'Tanga',
  'Mbeya',
]

// Short display names kwa tabs ndogo
export const REGION_SHORT: Record<string, string> = {
  'Dar es Salaam':            'Dar',
  'Zanzibar Mjini Magharibi': 'Zanzibar',
  'Zanzibar Kaskazini Unguja':'Znz Kaskazini',
  'Zanzibar Kusini Unguja':   'Znz Kusini',
  'Zanzibar Kaskazini Pemba': 'Pemba Kaskazini',
  'Zanzibar Kusini Pemba':    'Pemba Kusini',
}

export function shortName(region: string): string {
  return REGION_SHORT[region] ?? region.split(' ')[0]
}

// ── Wards (Kata) per district ────────────────────────────────────────────────
// Key: "Region||District"  Value: sorted ward list
const WARDS_DATA: Record<string, string[]> = {
  // ── Dar es Salaam ─────────────────────────────────────────────────────────
  'Dar es Salaam||Ilala': [
    'Buguruni', 'Chanika', 'Gerezani', 'Jangwani', 'Kariakoo',
    'Kipawa', 'Kiwalani', 'Kivukoni', 'Kitunda', 'Mchafukoge',
    'Msimbazi', 'Mtoni', 'Pugu', 'Sandali', 'Segerea',
    'Tabata', 'Ukonga', 'Upanga Magharibi', 'Upanga Mashariki',
    'Vingunguti', 'Zingiziwa',
  ],
  'Dar es Salaam||Kinondoni': [
    'Bunju', 'Goba', 'Hananasifu', 'Kawe', 'Kibamba',
    'Kigogo', 'Kinondoni', 'Kunduchi', 'Magomeni', 'Makongo',
    'Makuburi', 'Manzese', 'Mburahati', 'Mbweni', 'Mikocheni',
    'Msasani', 'Mwananyamala', 'Ndugumbi', 'Tandale',
  ],
  'Dar es Salaam||Temeke': [
    'Azimio', 'Chamazi', "Chang'ombe", 'Kibada', 'Keko',
    'Kurasini', 'Makangarawe', 'Mbagala', 'Miburani',
    'Mjimwema', 'Pemba Mnazi', 'Satellite', 'Somangila',
    'Tandika', 'Temeke', 'Toangoma',
  ],
  'Dar es Salaam||Ubungo': [
    'Goba', 'Kibamba', 'Kimara', 'Kwembe', 'Luguruni',
    'Mabibo', 'Makongo', 'Mbezi', 'Msigani', 'Palestina',
    'Shangingi', 'Sinza', 'Ubungo',
  ],
  'Dar es Salaam||Kigamboni': [
    'Kibada', "Ng'ombe", 'Somangila', 'Toangoma', 'Vijibweni',
  ],
  // ── Dodoma ────────────────────────────────────────────────────────────────
  'Dodoma||Dodoma Mjini': [
    "Chang'ombe", 'Chilonwa', 'Hombolo', 'Imagi', 'Ipagala',
    'Kikuyu', 'Makole', 'Mlimwa', 'Msalato', 'Muungano',
    'Miyuji', 'Mbabala', 'Nkuhungu', 'Nzuguni', 'Uhuru', 'Zuzu',
  ],
  // ── Arusha ────────────────────────────────────────────────────────────────
  'Arusha||Arusha Mjini': [
    'Daraja Mbili', 'Elerai', 'Engira', 'Kaloleni', 'Kati',
    'Kimandolu', 'Kokar', 'Lemara', 'Levolosi', 'Moshono',
    'Oloirien', 'Sekei', 'Sokon I', 'Sokon II', 'Themi',
    'Unga Limited',
  ],
  'Arusha||Meru': [
    'Arusha Chini', 'Ngarenanyuki', 'Nkoaranga', 'Poli',
    'Samaria', 'Songota', 'Usa River',
  ],
  // ── Mwanza ────────────────────────────────────────────────────────────────
  'Mwanza||Nyamagana': [
    'Buhongwa', 'Igoma', 'Isamilo', 'Kishimba', 'Mahina',
    'Mkolani', 'Mirongo', 'Nyamagana',
  ],
  'Mwanza||Ilemela': [
    'Buswelu', 'Igogo', 'Ilemela', 'Kiloleli', 'Luchelele',
    'Mirongo', 'Mwanza Urban', 'Nyamagana',
  ],
  // ── Kilimanjaro ───────────────────────────────────────────────────────────
  'Kilimanjaro||Moshi Mjini': [
    'Bondeni', 'Kaloleni', 'Kindi', 'Kirima', 'Mji Mpya',
    'Mwangaria', 'Rau', 'Uru',
  ],
  // ── Tanga ─────────────────────────────────────────────────────────────────
  'Tanga||Tanga Mjini': [
    'Chumbageni', 'Duga', 'Kaloleni', 'Matopeni', 'Mzingani',
    'Ngamiani Kaskazini', 'Ngamiani Kusini', 'Pasua',
    'Tanga', 'Uledi',
  ],
  // ── Mbeya ─────────────────────────────────────────────────────────────────
  'Mbeya||Mbeya Mjini': [
    'Forest', 'Iganjo', 'Ijombe', 'Ilomba', 'Iyela',
    'Mwanjelwa', 'Nsalaga', 'Nzovwe', 'Sisimba', 'Thamani', 'Uyole',
  ],
  // ── Morogoro ──────────────────────────────────────────────────────────────
  'Morogoro||Morogoro Mjini': [
    'Bonde la Mpunga', 'Chamwino', 'Kihonda', 'Kingolwira',
    'Mji Mpya', 'Mwembesongo', 'Mwere', 'Mzinga', 'Sabasaba',
  ],
  // ── Zanzibar ──────────────────────────────────────────────────────────────
  'Zanzibar Mjini Magharibi||Mjini': [
    'Fujoni', 'Kariakoo', 'Kibandamaiti', 'Kwahani', 'Mji Mkongwe',
    'Mlandege', 'Mpendae', 'Mwanakwerekwe', 'Shaurimoyo',
  ],
  'Zanzibar Mjini Magharibi||Magharibi A': [
    'Bumbwini', 'Chaani', 'Fuoni', 'Kinyasini', 'Mahonda', 'Mkwajuni',
  ],
  'Zanzibar Mjini Magharibi||Magharibi B': [
    'Bambao', 'Chwaka', 'Donge', 'Konde', 'Matemwe',
  ],
  // ── Kigoma ────────────────────────────────────────────────────────────────
  'Kigoma||Kigoma Mjini': [
    'Gungu', 'Kagera', 'Kigoma Mjini', 'Kibirizi', 'Mwanga', 'Ujiji',
  ],
  // ── Shinyanga ─────────────────────────────────────────────────────────────
  'Shinyanga||Shinyanga Mjini': [
    'Kambarage', 'Lwamgasa', 'Mhongolo', 'Sabasaba', 'Shinyanga Mjini',
  ],
  // ── Tabora ────────────────────────────────────────────────────────────────
  'Tabora||Tabora Mjini': [
    'Gongoni', 'Isevya', 'Itobo', 'Kalunde', 'Kawawa', 'Lusungo', 'Malolo',
  ],
  // ── Iringa ────────────────────────────────────────────────────────────────
  'Iringa||Iringa Mjini': [
    'Gangilonga', 'Mji Mpya', 'Mkwawa', 'Ruaha', 'Tosamaganga',
  ],
  // ── Mtwara ────────────────────────────────────────────────────────────────
  'Mtwara||Mtwara Mjini': [
    'Chuno', 'Dihimba', 'Funo', 'Likombe', 'Mji Mpya', 'Shangani',
  ],
  // ── Lindi ─────────────────────────────────────────────────────────────────
  'Lindi||Lindi Mjini': [
    'Lindi Mjini', 'Mchinga', 'Mtanda', 'Rasbura',
  ],
  // ── Pwani ─────────────────────────────────────────────────────────────────
  'Pwani||Kibaha Mjini': [
    'Kibaha Mji', 'Kibaha Mji Mpya', 'Kwala', 'Soga', 'Tungi',
  ],
  // ── Njombe ────────────────────────────────────────────────────────────────
  'Njombe||Njombe Mjini': [
    'Igominyi', 'Lupembe', 'Makambako', 'Njombe Mjini', "Wanging'ombe",
  ],
}

export function getWards(region: string, district: string): string[] {
  return WARDS_DATA[`${region}||${district}`] ?? []
}
