import { onRequest as __api_webdav___path___ts_onRequest } from "D:\\programmer\\personal bookkeeping\\functions\\api\\webdav\\[[path]].ts"

export const routes = [
    {
      routePath: "/api/webdav/:path*",
      mountPath: "/api/webdav",
      method: "",
      middlewares: [],
      modules: [__api_webdav___path___ts_onRequest],
    },
  ]