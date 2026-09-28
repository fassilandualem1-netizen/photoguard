import type { Plugin } from 'vite';
import https from 'https';
import { IncomingMessage, ServerResponse } from 'http';

interface MediaItem {
  id: number;
  album_id: number;
  filename: string;
  url: string;
  thumbnail_url: string;
  is_selected: boolean;
  client_notes: string | null;
}

interface AlbumData {
  id: number;
  title: string;
  client_name: string;
  pin: string;
  photographer_id: number;
  is_locked: boolean;
  allow_download: boolean;
  view_count: number;
  media_items: MediaItem[];
  creator_name: string;
  photographer_name: string;
  contact_phone: string;
  telegram_url: string;
}

// In-memory persistent state for dev session
const ALBUMS: Record<string, AlbumData> = {
  '998976': {
    id: 101,
    title: 'Helen & Dawit Wedding Shoot',
    client_name: 'Helen Haile',
    pin: '998976',
    photographer_id: 1,
    is_locked: false,
    allow_download: true,
    view_count: 14,
    creator_name: 'Dawit Studio Pro',
    photographer_name: 'Dawit Kebede',
    contact_phone: '+251 91 123 4567',
    telegram_url: 'https://t.me/photoguard_demo',
    media_items: [
      {
        id: 1001,
        album_id: 101,
        filename: 'IMG_8421_PORTRAIT.CR3',
        url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80',
        is_selected: true,
        client_notes: 'Please soften shadow under chin and enhance eye contrast'
      },
      {
        id: 1002,
        album_id: 101,
        filename: 'IMG_8422_EDITORIAL.CR3',
        url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=600&q=80',
        is_selected: true,
        client_notes: 'Love this smile! Color grade in warm champagne tones'
      },
      {
        id: 1003,
        album_id: 101,
        filename: 'IMG_8423_CANDID.CR3',
        url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=600&q=80',
        is_selected: true,
        client_notes: null
      },
      {
        id: 1004,
        album_id: 101,
        filename: 'IMG_8424_SUNSET.CR3',
        url: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=600&q=80',
        is_selected: true,
        client_notes: 'Golden flare looks incredible, keep it untouched'
      },
      {
        id: 1005,
        album_id: 101,
        filename: 'IMG_8425_DETAIL.CR3',
        url: 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      },
      {
        id: 1006,
        album_id: 101,
        filename: 'IMG_8426_CINEMATIC.CR3',
        url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      },
      {
        id: 1007,
        album_id: 101,
        filename: 'IMG_8427_ACTION.CR3',
        url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      },
      {
        id: 1008,
        album_id: 101,
        filename: 'IMG_8428_BLACKWHITE.CR3',
        url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      },
      {
        id: 1009,
        album_id: 101,
        filename: 'IMG_8429_RECEPTION.CR3',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      },
      {
        id: 1010,
        album_id: 101,
        filename: 'IMG_8430_STUDIO.CR3',
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      },
      {
        id: 1011,
        album_id: 101,
        filename: 'IMG_8431_FAMILY.CR3',
        url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      },
      {
        id: 1012,
        album_id: 101,
        filename: 'IMG_8432_LACE.CR3',
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
        is_selected: false,
        client_notes: null
      }
    ]
  },
  '782341': {
    id: 102,
    title: 'Addis Fashion Week Editorial',
    client_name: 'Kidus Studio',
    pin: '782341',
    photographer_id: 2,
    is_locked: false,
    allow_download: true,
    view_count: 38,
    creator_name: 'Kidus Media',
    photographer_name: 'Kidus Berhe',
    contact_phone: '+251 92 345 6789',
    telegram_url: 'https://t.me/photoguard_demo',
    media_items: [
      {
        id: 2001,
        album_id: 102,
        filename: 'AFW_001.NEF',
        url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
        is_selected: true,
        client_notes: 'Editorial color grade'
      },
      {
        id: 2002,
        album_id: 102,
        filename: 'AFW_002.NEF',
        url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80',
        is_selected: true,
        client_notes: null
      }
    ]
  },
  '456123': {
    id: 103,
    title: 'Selam Graduation Portraits',
    client_name: 'Selamawit T.',
    pin: '456123',
    photographer_id: 1,
    is_locked: true,
    allow_download: true,
    view_count: 52,
    creator_name: 'Dawit Studio Pro',
    photographer_name: 'Dawit Kebede',
    contact_phone: '+251 91 123 4567',
    telegram_url: 'https://t.me/photoguard_demo',
    media_items: [
      {
        id: 3001,
        album_id: 103,
        filename: 'GRAD_01.CR3',
        url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=85',
        thumbnail_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
        is_selected: true,
        client_notes: 'Approved for final prints'
      }
    ]
  }
};

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function devApiPlugin(): Plugin {
  return {
    name: 'photoguard-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url || '';

        // Only handle /api endpoints and health checks
        if (!url.startsWith('/api') && url !== '/health') {
          return next();
        }

        const method = (req.method || 'GET').toUpperCase();

        try {
          // Health check
          if (url === '/health' || url === '/api/health') {
            return sendJson(res, 200, {
              status: 'healthy',
              service: 'photoguard-live-sync',
              timestamp: new Date().toISOString()
            });
          }

          // GET /api/live/albums or GET /api/v1/albums
          if (url.startsWith('/api/live/albums') || url === '/api/v1/albums') {
            const list = Object.values(ALBUMS).map(a => ({
              id: a.id,
              title: a.title,
              pin: a.pin,
              client_name: a.client_name,
              is_locked: a.is_locked,
              allow_download: a.allow_download,
              media_count: a.media_items.length,
              selected_count: a.media_items.filter(m => m.is_selected).length
            }));
            return sendJson(res, 200, list);
          }

          // POST /api/v1/client/verify
          if (url.startsWith('/api/v1/client/verify') && method === 'POST') {
            const body = await parseBody(req);
            const pin = String(body.pin || '').trim();

            if (ALBUMS[pin]) {
              return sendJson(res, 200, ALBUMS[pin]);
            }

            // Fallback check if PIN exists in any album
            const found = Object.values(ALBUMS).find(a => a.pin === pin);
            if (found) {
              return sendJson(res, 200, found);
            }

            return sendJson(res, 404, { detail: 'Invalid 6-digit PIN. Album not found.' });
          }

          // PATCH /api/v1/client/media/:id
          const patchMediaMatch = url.match(/\/api\/v1\/client\/media\/(\d+)/);
          if (patchMediaMatch && (method === 'PATCH' || method === 'POST')) {
            const mediaId = parseInt(patchMediaMatch[1], 10);
            const body = await parseBody(req);

            for (const album of Object.values(ALBUMS)) {
              const photo = album.media_items.find(m => m.id === mediaId);
              if (photo) {
                if (typeof body.is_selected === 'boolean') {
                  photo.is_selected = body.is_selected;
                }
                if (typeof body.client_notes === 'string') {
                  photo.client_notes = body.client_notes;
                }
                return sendJson(res, 200, { success: true, item: photo });
              }
            }
            return sendJson(res, 404, { detail: 'Media item not found' });
          }

          // PUT /api/v1/albums/:id/toggle-download or PATCH /api/v1/albums/:id/toggle-download
          const toggleDownloadMatch = url.match(/\/api\/v1\/albums\/(\d+)\/toggle-download/);
          if (toggleDownloadMatch && (method === 'PUT' || method === 'POST' || method === 'PATCH')) {
            const albumId = parseInt(toggleDownloadMatch[1], 10);
            for (const album of Object.values(ALBUMS)) {
              if (album.id === albumId) {
                album.allow_download = !album.allow_download;
                return sendJson(res, 200, {
                  success: true,
                  allow_download: album.allow_download,
                  message: album.allow_download ? 'Client Gallery Download Enabled' : 'Client Gallery Download Disabled',
                  album
                });
              }
            }
            return sendJson(res, 404, { detail: 'Album not found' });
          }

          // GET /api/v1/client/:pin/download or /api/v1/client/download
          const clientDownloadMatch = url.match(/\/api\/v1\/client\/(\d+)\/download/);
          if (clientDownloadMatch && method === 'GET') {
            const pin = clientDownloadMatch[1];
            const album = ALBUMS[pin];
            if (album) {
              const selectedOnly = album.media_items.filter(m => m.is_selected);
              const downloadItems = selectedOnly.length > 0 ? selectedOnly : album.media_items;
              return sendJson(res, 200, {
                allow_download: album.allow_download,
                download_urls: downloadItems.map(m => m.url),
                photos: downloadItems
              });
            }
            return sendJson(res, 404, { detail: 'Album not found' });
          }

          // POST /api/v1/client/submit/:pin
          const submitMatch = url.match(/\/api\/v1\/client\/submit\/(\d+)/);
          if (submitMatch && method === 'POST') {
            const pin = submitMatch[1];
            if (ALBUMS[pin]) {
              ALBUMS[pin].is_locked = true;
              return sendJson(res, 200, {
                success: true,
                message: 'Selections submitted successfully and album locked.',
                album: ALBUMS[pin]
              });
            }
            return sendJson(res, 404, { detail: 'Album not found' });
          }

          // GET /api/v1/client/sync/:pin
          const syncMatch = url.match(/\/api\/v1\/client\/sync\/(\d+)/);
          if (syncMatch && method === 'GET') {
            const pin = syncMatch[1];
            if (ALBUMS[pin]) {
              const selectedCount = ALBUMS[pin].media_items.filter(m => m.is_selected).length;
              return sendJson(res, 200, {
                pin,
                is_locked: ALBUMS[pin].is_locked,
                selected_count: selectedCount,
                total_count: ALBUMS[pin].media_items.length
              });
            }
            return sendJson(res, 404, { detail: 'Album not found' });
          }

          // Default fallback for any unmatched /api call
          return sendJson(res, 200, {
            status: 'ok',
            message: `PhotoGuard endpoint ${url} acknowledged`,
            timestamp: new Date().toISOString()
          });
        } catch (err: any) {
          console.error('[API Middleware Error]', err);
          return sendJson(res, 500, { detail: err?.message || 'Internal server error' });
        }
      });
    }
  };
}
