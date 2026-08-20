/**
 * Service-area registry. Cities and coverage match the existing site's
 * city landing pages and service-by-city matrix.
 */

export interface City {
  id: string
  name: string
  /** primary = has a full city landing page on the old site */
  tier: 'primary' | 'extended'
  oldUrl: string
  /** approximate position on the service-area map, percent coordinates */
  map: { x: number; y: number }
}

export const cities: City[] = [
  { id: 'houston', name: 'Houston', tier: 'primary', oldUrl: '/', map: { x: 20, y: 14 } },
  { id: 'pasadena', name: 'Pasadena', tier: 'extended', oldUrl: '/ac-repair-pasadena-tx/', map: { x: 34, y: 26 } },
  { id: 'clear-lake-city', name: 'Clear Lake City', tier: 'primary', oldUrl: '/hvac-clear-lake-city-tx/', map: { x: 40, y: 42 } },
  { id: 'seabrook', name: 'Seabrook', tier: 'primary', oldUrl: '/hvac-seabrook-tx/', map: { x: 64, y: 40 } },
  { id: 'webster', name: 'Webster', tier: 'primary', oldUrl: '/hvac-webster-tx/', map: { x: 36, y: 55 } },
  { id: 'friendswood', name: 'Friendswood', tier: 'primary', oldUrl: '/hvac-friendswood-tx/', map: { x: 16, y: 64 } },
  { id: 'league-city', name: 'League City', tier: 'primary', oldUrl: '/hvac-league-city-tx/', map: { x: 34, y: 72 } },
  { id: 'bacliff', name: 'Bacliff', tier: 'extended', oldUrl: '/bacliff-tx-heating-air-conditioning-contractor/', map: { x: 62, y: 62 } },
  { id: 'hitchcock', name: 'Hitchcock', tier: 'extended', oldUrl: '/hitchcock-tx-heating-air-conditioning-contractor/', map: { x: 42, y: 90 } },
  { id: 'la-marque', name: 'La Marque', tier: 'extended', oldUrl: '/la-marque-tx-heating-air-conditioning-contractor/', map: { x: 58, y: 84 } },
  { id: 'texas-city', name: 'Texas City', tier: 'extended', oldUrl: '/texas-city-tx-heating-air-conditioning-contractor/', map: { x: 70, y: 76 } },
]

export const getCity = (id: string) => cities.find((c) => c.id === id)

/** ZIP codes listed on the old site's homepage service-area section. */
export const houstonZips =
  '77001 to 77083 (Houston metro), 77058 (Clear Lake), and surrounding bay-area ZIP codes'
