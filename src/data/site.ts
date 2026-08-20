/**
 * Big Texas Comfort — canonical business facts.
 * Every value here is sourced verbatim from the existing website
 * (bigtexascomfort-full-scrape.md). Do not add unverified claims.
 */

export const site = {
  name: 'Big Texas Comfort, Inc.',
  shortName: 'Big Texas Comfort',
  tagline: 'Customer For Life Service',
  description:
    'Heating, Cooling, Furnace & Air Conditioning Installation, Repair & Maintenance in Houston, TX and the surrounding areas.',
  url: 'https://www.bigtexascomfort.com',

  phone: '832-888-5166',
  phoneHref: 'tel:8328885166',
  phoneDisplay: '(832) 888-5166',

  address: {
    street: '2437 Bay Area Blvd Ste 38',
    city: 'Houston',
    state: 'TX',
    zip: '77058',
    full: '2437 Bay Area Blvd Ste 38, Houston, TX 77058',
    mapsUrl:
      'https://www.google.com/maps/place/Big+Texas+Comfort/@29.5642078,-95.0911062,15z/data=!4m5!3m4!1s0x0:0xaf406d4d76ff78b1!8m2!3d29.5642078!4d-95.0911062',
    geo: { lat: 29.5642078, lng: -95.0911062 },
  },

  hours: {
    regular: 'Mon to Sat, 7:00 AM to 9:00 PM',
    emergency: '24/7 Emergency Service Available',
    schema: 'Mo-Sa 07:00-21:00',
  },

  /** Satellite offices listed on the old site's city pages. */
  branches: [
    {
      name: 'Big Texas Comfort of League City',
      street: '2600 South Shore Blvd Suite 300',
      city: 'League City',
      state: 'TX',
      zip: '77573',
      phone: '832-402-7387',
      phoneHref: 'tel:8324027387',
    },
    {
      name: 'Big Texas Comfort of Webster',
      street: '2503 Plymouth Rock Ct',
      city: 'Webster',
      state: 'TX',
      zip: '77598',
      phone: '832-772-5549',
      phoneHref: 'tel:8327725549',
    },
  ],

  license: 'TACLA28370C',
  licenseLabel: 'TX License TACLA28370C',

  credentials: [
    {
      id: 'as-dealer',
      name: 'Independent American Standard Customer Care Dealer',
      blurb:
        'Hand-picked dealers with a proven commitment to excellence, product knowledge and customer service, trained on the latest technology for maximum efficiency, reliability and comfort.',
    },
    {
      id: 'ductless-pro',
      name: 'American Standard Ductless Pro Contractor',
      blurb:
        'Ductless Pro Contractors have access to exceptional tools and world-class products. More homeowners turn to them for outstanding service and installation.',
    },
    {
      id: 'nate',
      name: 'NATE-Certified Technicians',
      blurb:
        'Our technicians have passed the rigorous, independent North American Technician Excellence testing for the installation and service of HVAC-R equipment.',
    },
    {
      id: 'angi-ssa',
      name: "2017 Angie's List Super Service Award",
      blurb:
        'Awarded to companies maintaining an “A” rating in overall, recent and review-period grades, passing a background check and trade-license attestation.',
    },
    {
      id: 'bonded',
      name: 'Bonded, Insured & Licensed',
      blurb: 'Texas license TACLA28370C.',
    },
  ],

  offers: {
    diagnostic: 'Service calls $89.50 - diagnostic includes first hour of labor',
    estimates: 'Free estimates on new systems',
    secondOpinions: 'Free second opinions',
    military: 'Military and First Responders friendly. Ask us about our discounts.',
    referral:
      'Refer a friend: when your referral results in installation of a complete system, we thank you with a $50 dinner gift certificate.',
    r22: {
      headline: 'Need R22 Refrigerant?',
      detail:
        'T-2:2 jugs, virgin R-22, 30# available to EPA card holders. HVAC contractors welcome. $797.00 per jug.',
    },
  },

  payments: ['Cash', 'Check', 'Visa', 'Mastercard', 'Discover', 'American Express', 'Financing with approved credit'],

  financing: {
    partners: [
      {
        name: 'Wells Fargo Bank, N.A.',
        points: ['Convenient monthly payments', 'Special financing terms', 'Easy online account management'],
        blurb:
          'Several special options for financing your new product or service with approved credit, so you can invest in your home’s comfort without using up your existing funding sources.',
        applyUrl: 'https://retailservices.wellsfargo.com/pl/0024305229',
      },
      {
        name: 'FTL Finance',
        points: ['Low monthly payments', 'Preferred interest rates', 'Flexible terms'],
        blurb:
          'Through our close partnership with FTL, we offer a variety of flexible options for financing your new product or system.',
      },
    ],
  },

  mission:
    'Big Texas Comfort strives for excellence in customer satisfaction and provides “customer for life service” to achieve it.',
  vision:
    'To be the trademark name for HVAC in the areas we service, providing unmatched customer service consumers are looking for.',

  social: [
    { name: 'Facebook', url: 'https://www.facebook.com/BigTexasComfort' },
    { name: 'Instagram', url: 'https://www.instagram.com/bigtexascomfort212/' },
    { name: 'YouTube', url: 'https://www.youtube.com/channel/UCVLSNAJqkgDxR-YxNHq8R3Q/' },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/company/big-texas-comfort-inc./' },
    { name: 'Yelp', url: 'https://www.yelp.com/biz/big-texas-comfort-houston' },
    { name: 'Angi', url: 'https://www.angi.com/companylist/us/tx/houston/big-texas-comfort-reviews-9336263.htm' },
    { name: 'X', url: 'https://x.com/bigtexascomfort' },
    { name: 'Pinterest', url: 'https://www.pinterest.com/bigtexascomfort212/' },
  ],

  reviewLinks: {
    google:
      'https://www.google.com/maps/place/Big+Texas+Comfort/@29.5642078,-95.0932949,17z/data=!3m1!4b1!4m7!3m6!1s0x0:0xaf406d4d76ff78b1!8m2!3d29.5642078!4d-95.0911062!9m1!1b1',
    yelp: 'https://www.yelp.com/biz/big-texas-comfort-houston',
    facebook: 'https://www.facebook.com/BigTexasComfort',
    angi: 'https://www.angi.com/companylist/us/tx/houston/big-texas-comfort-reviews-9336263.htm',
  },

  /** The one verbatim on-site testimonial. Never invent more. */
  testimonial: {
    quote:
      'Bob installed a new high efficiency system in my home. It works awesome and is quiet. Uses little energy and I am so comfortable. The humidity levels are way down. I had zero problems and the price beat everyone. I highly recommend Bob to anyone who wants excellent, high quality service or installation.',
    author: 'Barbara N.',
    date: '31 Jul 2021',
    product: 'Air Conditioner',
  },

  /** Self-hosted copies: the originals sat on the outgoing vendor's storage. */
  pdfs: {
    seet: '/files/seet.pdf',
    rebates: '/files/centerpoint-rebates.pdf',
    awards: '/files/american-standard-awards.pdf',
  },

  organizationOffers: [
    'Factory Trained Techs Using Factory Best Practices',
    'Trusted Services - We Have 5 Star Google Reviews!',
    'Free Estimates and Second Opinions',
    'Residential Heating & Air Conditioning Products',
    'Installation & Replacement',
    'Equipment Retrofit & Replacement',
    'Preventative Maintenance',
    'Extended Service Agreements',
    'Extended Warranties on New Equipment',
    'Emergency Service',
    'Service All Makes & Models',
    'Sheet Metal Fabrication',
    'Air Duct Cleaning',
  ],
} as const

export type Site = typeof site
