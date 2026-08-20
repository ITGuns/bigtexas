/**
 * Every video embedded on the existing bigtexascomfort.com, with the real
 * titles, runtimes and poster frames read from Vimeo.
 *
 * Posters are the genuine opening frames, so a card reads correctly before
 * the player is loaded and while it buffers.
 */

export interface SiteVideo {
  id: string
  title: string
  vimeoId: string
  /** seconds, from Vimeo */
  duration: number
  poster: string
  blurb: string
  /**
   * Optional self-hosted file, e.g. '/video/air-promo.mp4'.
   * When set it is played directly and Vimeo is not touched at all, which
   * removes the embed restriction. Drop properly licensed files into
   * public/video/ and add the path here.
   */
  src?: string
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
export const runtime = (v: SiteVideo) => mmss(v.duration)

/** Commercials and promo spots that ran on the old homepage. */
export const adVideos: SiteVideo[] = [
  {
    id: 'raccoon-commercial',
    title: 'American Standard Raccoon Commercial',
    vimeoId: '267257017',
    duration: 30,
    poster: '/images/video/raccoon-commercial.jpg',
    blurb: 'The American Standard brand spot that opened the old homepage.',
    src: '/video/raccoon-commercial.mp4',
  },
  {
    id: 'air-promo',
    title: 'American Standard Air Promo',
    vimeoId: '569953090',
    duration: 30,
    poster: '/images/video/air-promo.jpg',
    blurb: 'What goes into an American Standard system, in half a minute.',
    src: '/video/air-promo.mp4',
  },
  {
    id: 'be-proactive',
    title: 'Be Proactive',
    vimeoId: '792779272',
    duration: 28,
    poster: '/images/video/be-proactive.jpg',
    blurb: 'Why catching a problem early costs less than waiting for a breakdown.',
    src: '/video/be-proactive.mp4',
  },
  {
    id: 'mitsubishi-heat-pumps',
    title: '4 Reasons to Choose Mitsubishi Electric Heat Pumps',
    vimeoId: '792779187',
    duration: 38,
    poster: '/images/video/mitsubishi-heat-pumps.jpg',
    blurb: 'The case for a ductless heat pump, from the manufacturer.',
    src: '/video/mitsubishi-heat-pumps.mp4',
  },
]

/** The longer "how does it work" equipment overviews. */
export const videos: SiteVideo[] = [
  {
    id: 'air-conditioner',
    title: 'Air Conditioner Overview',
    vimeoId: '121265019',
    duration: 309,
    poster: '/images/video/air-conditioner.jpg',
    blurb: 'How a split-system air conditioner moves heat out of your home.',
  },
  {
    id: 'heat-pump',
    title: 'Heat Pump Overview',
    vimeoId: '121265029',
    duration: 317,
    poster: '/images/video/heat-pump.jpg',
    blurb: 'One system that cools in summer and heats in winter.',
  },
  {
    id: 'air-handler',
    title: 'Air Handler Overview',
    vimeoId: '121265023',
    duration: 181,
    poster: '/images/video/air-handler.jpg',
    blurb: 'The indoor half of the system, moving conditioned air through the house.',
  },
  {
    id: 'gas-furnace',
    title: 'Furnace Overview',
    vimeoId: '121265026',
    duration: 301,
    poster: '/images/video/gas-furnace.jpg',
    blurb: 'How a modern furnace turns fuel into safe, even heat.',
  },
  {
    id: 'hybrid-heat',
    title: 'Hybrid Heat Overview',
    vimeoId: '121265030',
    duration: 259,
    poster: '/images/video/hybrid-heat.jpg',
    blurb: 'A heat pump paired with a furnace, switching to whichever runs cheapest.',
  },
]

export const allVideos = [...adVideos, ...videos]
