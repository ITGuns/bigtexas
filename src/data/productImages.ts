/**
 * Real equipment photography pulled from the existing site, mapped to the
 * product pages it belongs to. Every file in /public/images/products/ came
 * from bigtexascomfort.com. No stock imagery.
 */

export interface ProductImage {
  src: string
  alt: string
  /** photos sit on white in the source, so they need a light plate */
  plate?: boolean
}

export const productImages: Record<string, ProductImage> = {
  'air-conditioners': {
    src: '/images/products/american-standard-air-conditioner.png',
    alt: 'American Standard outdoor air conditioner condensing unit',
    plate: true,
  },
  'heat-pumps': {
    src: '/images/products/american-standard-heat-pump.png',
    alt: 'American Standard heat pump outdoor unit',
    plate: true,
  },
  'gas-furnaces': {
    src: '/images/products/american-standard-dual-fuel.png',
    alt: 'American Standard gas furnace',
    plate: true,
  },
  'duct-free-systems': {
    src: '/images/products/american-standard-ductless-systems.png',
    alt: 'American Standard ductless mini-split indoor unit',
    plate: true,
  },
  'packaged-units': {
    src: '/images/products/american-standard-packaged-unit.png',
    alt: 'American Standard packaged HVAC unit',
    plate: true,
  },
  'hybrid-heat': {
    src: '/images/products/american-standard-dual-fuel.png',
    alt: 'American Standard dual fuel hybrid heat system',
    plate: true,
  },
  'air-handlers': {
    src: '/images/products/air-handler.png',
    alt: 'American Standard air handler',
    plate: true,
  },
  'evaporator-coils': {
    src: '/images/products/evaporator-coil.png',
    alt: 'American Standard Platinum indoor evaporator coil',
    plate: true,
  },
  thermostats: {
    src: '/images/products/american-standard-thermostat.png',
    alt: 'American Standard programmable thermostat',
    plate: true,
  },
  'thermostats-zoning': {
    src: '/images/products/american-standard-zoning.png',
    alt: 'American Standard zoning control panel',
    plate: true,
  },
  zoning: {
    src: '/images/products/american-standard-zoning.png',
    alt: 'American Standard zoning system control',
    plate: true,
  },
  'air-cleaners': {
    src: '/images/products/american-standard-aircleaner.png',
    alt: 'American Standard whole-home air cleaner',
    plate: true,
  },
  'indoor-air-quality': {
    src: '/images/products/american-standard-aircleaner.png',
    alt: 'American Standard indoor air quality equipment',
    plate: true,
  },
  humidifiers: {
    src: '/images/products/american-standard-humidifier.png',
    alt: 'American Standard whole-home humidifier',
    plate: true,
  },
  dehumidifiers: {
    src: '/images/products/Aprilaire-dehumidifiers.png',
    alt: 'Aprilaire whole-home dehumidifier',
    plate: true,
  },
  ventilators: {
    src: '/images/products/american-standard-ventilator.png',
    alt: 'American Standard energy recovery ventilator',
    plate: true,
  },
  'ultra-violet-lights': {
    src: '/images/products/honeywell-ultra-violet-lights.png',
    alt: 'Honeywell ultraviolet air treatment light',
    plate: true,
  },
  'carbon-monoxide-detectors': {
    src: '/images/products/honeywell-co-detector.png',
    alt: 'Honeywell carbon monoxide detector',
    plate: true,
  },
  'american-standard-home-app': {
    src: '/images/products/home-app.png',
    alt: 'American Standard Home app running on a smartphone',
    plate: true,
  },
  'micropure-with-duo-field-control': {
    src: '/images/products/american-standard-aircleaner.png',
    alt: 'Whole-home air purification equipment',
    plate: true,
  },
}

/** Service pages that have a matching real photo. */
export const serviceImages: Record<string, ProductImage> = {
  'air-duct-cleaning': {
    src: '/images/products/duct-cleaning.png',
    alt: 'Air duct cleaning equipment in use',
    plate: true,
  },
  'ductless-mini-split-installation': {
    src: '/images/products/mitsubishi-wall.png',
    alt: 'Wall-mounted ductless mini-split indoor head',
    plate: true,
  },
  'ac-repair': {
    src: '/images/work-install-2.jpg',
    alt: 'Big Texas Comfort technician servicing an outdoor condenser',
  },
  'ac-installation': {
    src: '/images/work-install-1.jpg',
    alt: 'Rooftop HVAC unit being set during installation',
  },
  'hvac-installation': {
    src: '/images/work-install-3.jpg',
    alt: 'Completed outdoor condenser installation',
  },
  'commercial-hvac': {
    src: '/images/work-install-1.jpg',
    alt: 'Commercial rooftop HVAC unit being craned into place',
  },
}

export const getProductImage = (slug: string) => productImages[slug]
export const getServiceImage = (id: string) => serviceImages[id]
