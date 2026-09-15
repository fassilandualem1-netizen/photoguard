export interface User {
  id: number;
  email: string;
  role: 'admin' | 'photographer' | 'client';
  token?: string;
}

export interface Album {
  id: number;
  name: string;
  code: string;
  photographerId: number;
  imageCount: number;
  expires: string;
}

export interface ImageItem {
  id: number;
  filename: string;
  url: string;
}
