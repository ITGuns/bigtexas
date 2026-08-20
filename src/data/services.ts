/**
 * Canonical service registry. Names and scope match the existing site's
 * navigation and service pages; detailed page copy is merged from the
 * scraped content (src/data/extracted.ts).
 */

export type ServiceCategory = 'cooling' | 'heating' | 'air-quality' | 'ductwork' | 'plans' | 'commercial'

export interface Service {
  id: string
  name: string
  category: ServiceCategory
  short: string
  oldUrl: string
  emergency?: boolean
}

export const serviceCategories: { id: ServiceCategory; name: string; blurb: string }[] = [
  {
    id: 'cooling',
    name: 'Cooling',
    blurb: 'Repair, installation and seasonal maintenance for air conditioners in the Houston heat.',
  },
  {
    id: 'heating',
    name: 'Heating',
    blurb: 'Furnace and heat pump service for the cold snaps Gulf Coast winters still deliver.',
  },
  {
    id: 'air-quality',
    name: 'Air Quality',
    blurb: 'Testing and equipment for cleaner, healthier indoor air: humidity, filtration, ventilation.',
  },
  {
    id: 'ductwork',
    name: 'Ductwork & Efficiency',
    blurb: 'Duct cleaning, sealing, insulation, energy audits and custom sheet metal fabrication.',
  },
  {
    id: 'plans',
    name: 'Protection & Plans',
    blurb: 'Service agreements, extended warranties, upgrades and preventive maintenance programs.',
  },
  {
    id: 'commercial',
    name: 'Commercial',
    blurb: 'Commercial HVAC service for offices and light commercial buildings across the bay area.',
  },
]

export const services: Service[] = [
  // -- cooling --
  {
    id: 'ac-repair',
    name: 'AC Repair',
    category: 'cooling',
    short: 'Diagnosis and repair for all makes and models, before small faults become failures.',
    oldUrl: '/ac-repair-houston-tx/',
  },
  {
    id: 'ac-installation',
    name: 'AC Installation',
    category: 'cooling',
    short: 'New air conditioning systems, sized and installed to factory best practices.',
    oldUrl: '/Services/ac-installation-houston-tx/',
  },
  {
    id: 'ac-maintenance',
    name: 'AC Maintenance',
    category: 'cooling',
    short: 'Seasonal tune-ups that keep cooling capacity up and utility bills down.',
    oldUrl: '/seasonal-ac-maintenance-houston-tx/',
  },
  {
    id: 'emergency-ac-repair',
    name: 'Emergency Repair',
    category: 'cooling',
    short: '24/7 emergency response, seven days a week. Houston heat doesn’t wait.',
    oldUrl: '/services/emergency-ac-repair-houston-tx/',
    emergency: true,
  },
  {
    id: 'ductless-mini-split-installation',
    name: 'Ductless Mini-Split Installation',
    category: 'cooling',
    short: 'Room-by-room comfort without ductwork, installed by Ductless Pro contractors.',
    oldUrl: '/ductless-mini-split-installation-houston-tx/',
  },
  // -- heating --
  {
    id: 'furnace-repair',
    name: 'Furnace Repair',
    category: 'heating',
    short: 'Fast, accurate furnace diagnosis and repair for every major brand.',
    oldUrl: '/Heating/furnace-repair-houston-tx/',
  },
  {
    id: 'furnace-installation',
    name: 'Furnace Installation',
    category: 'heating',
    short: 'High-efficiency furnace installation matched to your home and lifestyle.',
    oldUrl: '/Heating/furnace-installation-houston-tx/',
  },
  {
    id: 'furnace-maintenance',
    name: 'Furnace Maintenance',
    category: 'heating',
    short: 'Pre-season checks that keep heating safe, efficient and reliable.',
    oldUrl: '/furnace-maintenance-houston-tx/',
  },
  {
    id: 'radiant-floor-heating',
    name: 'Radiant Floor Heating',
    category: 'heating',
    short: 'Quiet, even warmth from the floor up.',
    oldUrl: '/radiant-floor-heating-houston-tx/',
  },
  // -- air quality --
  {
    id: 'indoor-air-quality-testing',
    name: 'Air Quality Testing',
    category: 'air-quality',
    short: 'Find out what’s actually in your air, then fix it.',
    oldUrl: '/services/indoor-air-quality-testing-houston-tx/',
  },
  // -- ductwork & efficiency --
  {
    id: 'air-duct-cleaning',
    name: 'Air Duct Cleaning',
    category: 'ductwork',
    short: 'Remove years of dust and debris from the system your air travels through.',
    oldUrl: '/services/air-duct-cleaning-houston-tx/',
  },
  {
    id: 'air-duct-sealing',
    name: 'Air Duct Sealing',
    category: 'ductwork',
    short: 'Stop paying to condition air that leaks into the attic.',
    oldUrl: '/services/air-duct-sealing-houston-tx/',
  },
  {
    id: 'attic-insulation',
    name: 'Attic Insulation',
    category: 'ductwork',
    short: 'The cheapest cooling upgrade most Houston homes never make.',
    oldUrl: '/services/attic-insulation-houston-tx/',
  },
  {
    id: 'energy-audits',
    name: 'Energy Audits',
    category: 'ductwork',
    short: 'A whole-home look at where your energy and money are going.',
    oldUrl: '/services/energy-audits-houston-tx/',
  },
  {
    id: 'sheet-metal-fabrication',
    name: 'Sheet Metal Fabrication',
    category: 'ductwork',
    short: 'Custom-fabricated plenums, transitions and duct fittings, made to fit.',
    oldUrl: '/services/sheet-metal-fabrication-houston-tx/',
  },
  // -- plans & lifecycle --
  {
    id: 'hvac-installation',
    name: 'HVAC Installation',
    category: 'plans',
    short: 'Complete system installation for cooling, heating and air handling.',
    oldUrl: '/services/hvac-installation-houston-tx/',
  },
  {
    id: 'hvac-maintenance',
    name: 'Preventive HVAC Maintenance',
    category: 'plans',
    short: 'Regular checks that extend equipment life and protect efficiency.',
    oldUrl: '/services/preventive-hvac-maintenance-houston-tx/',
  },
  {
    id: 'upgrade-replacement',
    name: 'Upgrade or Replacement',
    category: 'plans',
    short: 'When repair stops making sense, we’ll size and install what’s next.',
    oldUrl: '/services/upgrade-replacement-houston-tx/',
  },
  {
    id: 'service-agreements',
    name: 'Service Agreements',
    category: 'plans',
    short: 'Scheduled care that keeps systems at peak performance, month after month.',
    oldUrl: '/services/service-agreements/',
  },
  {
    id: 'extended-warranties',
    name: 'Extended Warranties',
    category: 'plans',
    short: 'Longer protection on new equipment, in writing.',
    oldUrl: '/services/extended-warranties/',
  },
  // -- commercial --
  {
    id: 'commercial-hvac',
    name: 'Commercial HVAC',
    category: 'commercial',
    short: 'Comfort for offices and light commercial buildings, with minimal disruption.',
    oldUrl: '/commercial-hvac-houston-tx/',
  },
]

export const getService = (id: string) => services.find((s) => s.id === id)
export const servicesByCategory = (cat: ServiceCategory) => services.filter((s) => s.category === cat)
