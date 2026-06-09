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
