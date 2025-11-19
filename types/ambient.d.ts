declare module '@strapi/strapi' {
  export const factories: any;
}

declare module '@strapi/utils' {
  export const errors: any;
}

declare module '@strapi/strapi/admin' {
  export function useNotification(): { toggleNotification: (options: Record<string, unknown>) => void };
  export function useFetchClient(): {
    get: (...args: unknown[]) => Promise<any>;
    post: (...args: unknown[]) => Promise<any>;
    put: (...args: unknown[]) => Promise<any>;
    delete: (...args: unknown[]) => Promise<any>;
  };
}

declare module '@strapi/icons' {
  import type React from 'react';

  export type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export const Eye: IconComponent;
  const icons: Record<string, IconComponent>;
  export default icons;
}

