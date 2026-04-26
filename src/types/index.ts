/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
}

export interface OpeningHour {
  day: string;
  hours: string;
}

export interface LocationPhoto {
  id: number;
  url: string;
  alt: string;
}

export interface MenuApiResponse {
  coffeeItems: MenuItem[];
  pastryItems: MenuItem[];
  openingHours: OpeningHour[];
}

export interface LocationApiResponse {
  address: {
    line1: string;
    line2: string;
  };
  transport: string[];
  photos: LocationPhoto[];
  mapEmbedUrl: string;
}
